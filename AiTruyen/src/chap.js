// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// Chiến lược:
// 1. Thử lấy cookie từ localCookie (nếu đã đăng nhập qua browser của app)
// 2. Nếu có cookie → gọi API /api/chapters/{handle}/content
// 3. Nếu API thất bại hoặc không có cookie → dùng Engine.newBrowser() để load
//    trang trực tiếp (browser đã có session từ lần đăng nhập trước) và trích DOM

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
 * Trích nội dung chapter từ DOM bằng browser (browser đã có session).
 * Dùng khi API không hoạt động hoặc chưa đăng nhập qua API.
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        var doc = browser.launch(chapUrl, 15000);
        var content = "";

        if (doc) {
            // Thử các selector phổ biến của AiTruyen (Next.js render)
            var selectors = [
                ".chapter-content",
                "[class*='chapter-content']",
                "[class*='chapterContent']",
                "[class*='content']",
                "article",
                "main"
            ];
            for (var i = 0; i < selectors.length; i++) {
                try {
                    var el = doc.select(selectors[i]);
                    if (!el || el.isEmpty()) continue;
                    var txt = el.first().text();
                    if (txt && txt.length > 100) {
                        content = el.first().html();
                        break;
                    }
                } catch (se) {}
            }

            // Fallback: lấy toàn bộ body text
            if (!content || content.length < 100) {
                try {
                    var body = doc.select("body").first();
                    if (body) {
                        var bodyTxt = body.text();
                        if (bodyTxt && bodyTxt.length > 100) {
                            content = body.html();
                        }
                    }
                } catch (be) {}
            }
        }

        browser.close();
        return content;
    } catch (e) {
        try { if (browser) browser.close(); } catch (_) {}
        return "";
    }
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

        // API thất bại dù có cookie → thử browser (session có thể vẫn còn trong browser)
        var browserContent = loadViaNewBrowser(chapUrl);
        if (browserContent && browserContent.length > 50) {
            return Response.success(browserContent);
        }

        // Nếu browser cũng thất bại
        return Response.error("Không tải được nội dung. Vui lòng đăng nhập lại tại aitruyen.net rồi thử lại.");
    }

    // === Bước 3: Không có cookie → dùng browser trực tiếp ===
    // Browser đã lưu session từ lần đăng nhập trước trên aitruyen.net
    var browserContent = loadViaNewBrowser(chapUrl);
    if (browserContent && browserContent.length > 50) {
        return Response.success(browserContent);
    }

    // Chưa đăng nhập, hướng dẫn người dùng
    return Response.error("Vui lòng đăng nhập tại aitruyen.net trên trình duyệt của ứng dụng, sau đó thử lại.");
}
