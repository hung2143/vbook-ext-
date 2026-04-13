// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// Chiến lược:
// 1. Thử lấy cookie từ localCookie (nếu đã đăng nhập qua browser của app)
// 2. Nếu có cookie → gọi API /api/chapters/{handle}/content
// 3. Nếu API thất bại hoặc không có cookie → dùng Engine.newBrowser() render
//    và dùng callJs() để trích chính xác nội dung các đoạn truyện

var HOST = "https://aitruyen.net";

/**
 * Lấy cookie session từ localCookie (chia sẻ với Engine.newBrowser).
 */
function getSessionCookies() {
    try {
        var c = localCookie.getCookie();
        if (c && String(c).length > 5) return String(c);
    } catch (e) {}
    return "";
}

/**
 * Trích chapterHandle từ RSC data (script __next_f) trong HTML.
 */
function extractChapterHandle(html) {
    var m = html.match(/\\\"chapterHandle\\\":\\\"(rh1\.[^\"\\]+)/)
           || html.match(/"chapterHandle":"(rh1\.[^"]+)"/);
    return m ? m[1] : "";
}

/**
 * Gọi API content với cookie.
 * Trả về chuỗi HTML nội dung, hoặc rỗng nếu thất bại.
 */
function callContentApi(chapUrl, chapterHandle, cookieStr) {
    var bffProof = "";
    var bffMatch = cookieStr.match(/(?:^|;)\s*aitruyen_bff_proof=([^;]+)/);
    if (bffMatch) {
        try { bffProof = decodeURIComponent(bffMatch[1].trim()); }
        catch (e) { bffProof = bffMatch[1].trim(); }
    }

    var contentUrl = HOST + "/api/chapters/" + encodeURIComponent(chapterHandle) + "/content";
    var apiHeaders = {
        "user-agent": UserAgent.chrome(),
        "accept": "application/json",
        "content-type": "application/json",
        "referer": chapUrl,
        "origin": HOST,
        "cookie": cookieStr
    };
    if (bffProof) apiHeaders["x-aitruyen-browser-proof"] = bffProof;

    try {
        var apiResp = fetch(contentUrl, {
            method: "POST",
            headers: apiHeaders,
            body: "{}"
        });
        if (!apiResp || !apiResp.ok) return "";

        var json = apiResp.json();
        if (!json) return "";
        if (json.status === "requires_auth") return "";

        var contentHtml = json.contentHtml || json.content || json.html || "";
        return String(contentHtml).trim();
    } catch (e) {}
    return "";
}

/**
 * Dùng Engine.newBrowser() để render trang rồi dùng callJs() trích nội dung.
 * Browser đã có session từ lần đăng nhập trước → nội dung sẽ hiện ra.
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        // Load trang, chờ 15 giây để JS render xong
        browser.launch(chapUrl, 15000);

        // Dùng callJs để lấy nội dung: tìm container chứa nhiều đoạn văn nhất
        // Lọc ra những <p> có text dài (>= 20 ký tự) và không phải UI
        var jsCode = "(function(){" +
            // Danh sách các container ứng viên (ưu tiên cao → thấp)
            "var candidates=[" +
            "  '[class*=\"ChapterContent\"]'," +
            "  '[class*=\"chapter-content\"]'," +
            "  '[class*=\"chapterContent\"]'," +
            "  '[class*=\"readerContent\"]'," +
            "  '[class*=\"reader-content\"]'," +
            "  '[class*=\"content-chapter\"]'," +
            "  '.prose'," +
            "  'article'," +
            "  'main'" +
            "];" +
            // Tìm container có nhiều text nhất
            "var best='', bestLen=0;" +
            "for(var i=0;i<candidates.length;i++){" +
            "  try{" +
            "    var els=document.querySelectorAll(candidates[i]);" +
            "    for(var j=0;j<els.length;j++){" +
            "      var t=(els[j].innerText||'').trim();" +
            "      if(t.length>bestLen){bestLen=t.length;best=els[j].innerHTML||'';}" +
            "    }" +
            "    if(bestLen>200)break;" +
            "  }catch(e){}" +
            "}" +
            // Nếu không tìm được container → ghép tất cả <p> dài
            "if(bestLen<200){" +
            "  var ps=document.querySelectorAll('p');" +
            "  var arr=[];" +
            "  var noiseRe=/^(Chương|Chapter|Trước|Sau|Mục lục|Thảo luận|Bình luận|Đăng nhập|Đăng ký|Trang chủ|Theo dõi|Thông báo|phản hồi|sẵn sàng|vBook)/i;" +
            "  for(var k=0;k<ps.length;k++){" +
            "    var txt=(ps[k].innerText||'').trim();" +
            "    if(txt.length>=20 && !noiseRe.test(txt)){arr.push('<p>'+txt+'</p>');}" +
            "  }" +
            "  if(arr.length>=3){best=arr.join('\\n');}" +
            "}" +
            "return best;" +
            "})()";

        var result = browser.callJs(jsCode, 8000);
        var content = "";
        if (result) {
            // callJs trả về Document hoặc string tuỳ API
            try { content = result.text ? String(result.text()) : String(result); }
            catch (e) { content = String(result); }
        }

        browser.close();

        if (content && content.trim().length > 50) {
            return content.trim();
        }
        return "";
    } catch (e) {
        try { if (browser) browser.close(); } catch (_) {}
        return "";
    }
}

function execute(url) {
    var m = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!m) return null;
    var storySlug = m[1];
    var chapNum = m[2];
    var chapUrl = HOST + "/truyen/" + storySlug + "/chuong-" + chapNum;

    // === Bước 1: Thử lấy cookie từ localCookie ===
    var cookieStr = getSessionCookies();

    // === Bước 2: Nếu có cookie → thử lấy chapterHandle qua HTTP và gọi API ===
    if (cookieStr) {
        try {
            var pageResp = fetch(chapUrl, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": HOST,
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
                    "cookie": cookieStr
                }
            });

            if (pageResp && pageResp.ok) {
                var doc = pageResp.html("utf-8");
                if (doc) {
                    var pageHtml = doc.html() || "";
                    var chapterHandle = extractChapterHandle(pageHtml);

                    if (chapterHandle) {
                        var apiContent = callContentApi(chapUrl, chapterHandle, cookieStr);
                        if (apiContent && apiContent.length > 10) {
                            return Response.success(apiContent);
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // === Bước 3: Dùng browser để render (có hoặc không có cookie) ===
    // Browser đã lưu session từ lần đăng nhập trước trên aitruyen.net
    var browserContent = loadViaNewBrowser(chapUrl);
    if (browserContent && browserContent.length > 50) {
        return Response.success(browserContent);
    }

    // Chưa đăng nhập hoặc không lấy được nội dung
    return Response.error("Vui lòng đăng nhập tại aitruyen.net trên trình duyệt của ứng dụng, sau đó thử lại.");
}
