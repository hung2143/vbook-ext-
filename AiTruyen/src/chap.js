// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// Chiến lược:
// 1. Thử lấy cookie từ localCookie (nếu đã đăng nhập qua browser của app)
// 2. Nếu có cookie → gọi API /api/chapters/{handle}/content
// 3. Nếu API thất bại hoặc không có cookie → dùng Engine.newBrowser() render
//    và dùng callJs() để trích chính xác nội dung các đoạn truyện
//
// Lưu ý quan trọng (2026-04-13):
//   - Trang AiTruyen là React/Next.js app → CẦN busyWait() sau launch()
//     để đợi React hydrate + API fetch nội dung chương
//   - Có ÍT NHẤT 2 thẻ <article> trong DOM:
//       article.mt-6       → chứa AI unlock notice, KHÔNG PHẢI nội dung
//       article.reader-prose.rich-content → NỘI DUNG TRUYỆN THẬT
//   - Selector chính xác: article.reader-prose hoặc [class*="rich-content"]

var HOST = "https://aitruyen.net";

/**
 * Busy-wait: block thread trong ms milliseconds.
 * Cần thiết vì Engine.newBrowser().launch() chỉ bắt đầu load,
 * không đợi React/Next.js render xong.
 */
function busyWait(ms) {
    var s = new Date().getTime();
    while (new Date().getTime() - s < ms) {}
}

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
    var m = html.match(/\\\"chapterHandle\\\":\\\"(rh1\\.[^\"\\]+)/)
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
 *
 * DOM structure đã xác nhận qua browser debug (2026-04-13):
 *   - article.mt-6  → chứa AI unlock notice, header → KHÔNG LẤY
 *   - article.reader-prose.rich-content → NỘI DUNG TRUYỆN → LẤY CÁI NÀY
 *   - Bên trong có các <p> tags = từng đoạn văn → lấy trực tiếp
 *
 * QUAN TRỌNG: Phải dùng busyWait() sau launch() vì:
 *   browser.launch(url, timeout) chỉ bắt đầu load trang
 *   React/Next.js cần thêm thời gian để hydrate + fetch nội dung từ API
 *   Không busyWait → callJs chạy trên DOM chưa render → không tìm thấy element
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(chapUrl, 30000);

        // CHỜ React render xong - đây là bước THIẾU trước đây
        // AiTruyen cần: page load + React hydrate + API fetch content
        busyWait(8000);

        // JS đơn giản: tìm đúng article.reader-prose, lấy innerHTML
        var jsCode = "(function(){" +
            // Tìm article.reader-prose (nội dung truyện sạch)
            "var art=document.querySelector('article.reader-prose');" +
            "if(!art)art=document.querySelector('article[class*=\"reader-prose\"]');" +
            "if(!art)art=document.querySelector('[class*=\"rich-content\"]');" +
            "if(art){" +
            // Clone để xóa junk bên trong (nếu có)
            "  var clone=art.cloneNode(true);" +
            "  var junk=clone.querySelectorAll('script,style,svg,button,[role=\"button\"]');" +
            "  for(var i=junk.length-1;i>=0;i--){try{junk[i].parentNode.removeChild(junk[i]);}catch(e){}}" +
            // Lấy các <p> tags → HTML output với xuống hàng đúng
            "  var ps=clone.querySelectorAll('p');" +
            "  if(ps.length>=2){" +
            "    var res=[];" +
            "    for(var i=0;i<ps.length;i++){" +
            "      var txt=(ps[i].innerText||'').trim();" +
            "      if(txt.length>0)res.push('<p>'+txt+'</p>');" +
            "    }" +
            "    if(res.length>=2)return res.join('\\n');" +
            "  }" +
            // Fallback: lấy innerHTML trực tiếp
            "  var h=clone.innerHTML;" +
            "  if(h&&h.length>50)return h;" +
            "}" +
            // Fallback 2: không tìm thấy reader-prose → thử aria-live
            "var live=document.querySelector('[aria-live]');" +
            "if(live){" +
            "  var ps2=live.querySelectorAll('p');" +
            "  if(ps2.length>=2){" +
            "    var res2=[];" +
            "    for(var j=0;j<ps2.length;j++){" +
            "      var t2=(ps2[j].innerText||'').trim();" +
            "      if(t2.length>0)res2.push('<p>'+t2+'</p>');" +
            "    }" +
            "    if(res2.length>=2)return res2.join('\\n');" +
            "  }" +
            "}" +
            "return '';" +
            "})()";

        var result = browser.callJs(jsCode, 10000);
        var content = "";
        if (result) {
            try { content = result.text ? String(result.text()) : String(result); }
            catch (e) { content = String(result); }
        }

        browser.close();

        if (content && content.trim().length > 50) {
            return cleanBrowserContent(content.trim());
        }
        return "";
    } catch (e) {
        try { if (browser) browser.close(); } catch (_) {}
        return "";
    }
}

/**
 * Làm sạch HTML trả về từ browser:
 * - Xóa script/style/svg/button tags
 * - Giữ nguyên <p> tags và nội dung text
 */
function cleanBrowserContent(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
    html = html.replace(/<button[\s\S]*?<\/button>/gi, "");
    return html.trim();
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
