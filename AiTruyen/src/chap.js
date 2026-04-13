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
 * Cấu trúc DOM đã xác nhận (debug thực tế 2026-04-13):
 *   - Nội dung chương nằm trong: article.reader-prose.rich-content
 *   - Các thẻ <p> con trực tiếp của article đó = nội dung truyện sạch 100%
 *   - Không cần filter junk nếu dùng đúng selector
 *
 * VBook cần nhận HTML với <p> tags để render đúng xuống hàng.
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(chapUrl, 12000);

        // JS cực kỳ đơn giản: chỉ lấy innerHTML của article.reader-prose
        // Nếu không có, fallback lấy các <p> có parent là article
        var jsCode = "(function(){" +
            // Cách 1: Selector chính xác nhất
            "var art=document.querySelector('article.reader-prose');" +
            "if(!art)art=document.querySelector('article[class*=\"reader-prose\"]');" +
            "if(!art)art=document.querySelector('[class*=\"rich-content\"]');" +
            "if(art){" +
            // Lấy innerHTML trực tiếp — đã có sẵn <p> tags đúng format
            "  var html=art.innerHTML;" +
            "  if(html&&html.length>50)return html;" +
            "}" +
            // Cách 2: Fallback — lấy từng <p> có parent là article
            "var ps=document.querySelectorAll('article p');" +
            "var res=[];" +
            "for(var i=0;i<ps.length;i++){" +
            "  var txt=(ps[i].innerText||'').trim();" +
            "  if(txt.length<10)continue;" +
            "  res.push('<p>'+txt+'</p>');" +
            "}" +
            "if(res.length>=3)return res.join('\\n');" +
            // Cách 3: Last resort — article innerText tách theo dòng
            "var artEl=document.querySelector('article');" +
            "if(!artEl)return '';" +
            "var raw=(artEl.innerText||'').trim();" +
            "if(raw.length<50)return '';" +
            "var lines=raw.split('\\n');" +
            "res=[];" +
            "for(var j=0;j<lines.length;j++){" +
            "  var ln=lines[j].trim();" +
            "  if(ln.length>=15)res.push('<p>'+ln+'</p>');" +
            "}" +
            "return res.join('\\n');" +
            "})()";

        var result = browser.callJs(jsCode, 8000);
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
 * - Xóa script/style tags
 * - Xóa buttons, svg, hidden elements
 * - Giữ nguyên <p> tags và nội dung text
 */
function cleanBrowserContent(html) {
    if (!html) return "";
    // Xóa script/style
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Xóa svg
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
    // Xóa button
    html = html.replace(/<button[\s\S]*?<\/button>/gi, "");
    // Xóa div[aria-hidden]
    html = html.replace(/<[^>]+aria-hidden="true"[\s\S]*?<\/[^>]+>/gi, "");
    // Xóa các phần tử animate-pulse (skeleton loader)
    html = html.replace(/<[^>]+animate-pulse[\s\S]*?<\/[^>]+>/gi, "");
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
