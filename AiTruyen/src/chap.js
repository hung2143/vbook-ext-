// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// AiTruyen dùng Next.js React Server Components (RSC/__next_f).
// Nội dung chương lấy qua API: POST /api/chapters/{encodeURIComponent(chapterHandle)}/content
// chapterHandle được nhúng trong __next_f RSC data của trang HTML.
// API yêu cầu cookie session (người dùng phải đăng nhập qua Engine.newBrowser()).

var HOST = "https://aitruyen.net";
var LOGIN_MSG = "Vui lòng đăng nhập tại aitruyen.net để đọc truyện, sau đó thử lại.";

/**
 * Lấy cookie session từ plugin WebView (cùng store với Engine.newBrowser).
 */
function getSessionCookies() {
    try {
        var c = localCookie.getCookie();
        if (c && String(c).length > 5) return String(c);
    } catch (e) {}
    return "";
}

/**
 * Mở trình duyệt trong ứng dụng để người dùng đăng nhập, chờ tối đa ~3 phút.
 * Trả về cookie sau khi đăng nhập (có thể rỗng nếu quá thời gian).
 */
function doLogin(chapUrl) {
    var cookieStr = "";
    try {
        var browser = Engine.newBrowser();
        // Mở trang chương trong trình duyệt plugin (chia sẻ cookie với localCookie)
        browser.launch(chapUrl, 8000);
        // Chờ người dùng đăng nhập - poll mỗi 3 giây, tối đa 60 lần (~3 phút)
        var maxTries = 60;
        for (var i = 0; i < maxTries; i++) {
            sleep(3000);
            var c = getSessionCookies();
            if (c && c.length > 10) {
                cookieStr = c;
                break;
            }
        }
        browser.close();
    } catch (e) {}
    return cookieStr;
}

function execute(url) {
    var m = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!m) return null;
    var storySlug = m[1];
    var chapNum = m[2];
    var chapUrl = HOST + "/truyen/" + storySlug + "/chuong-" + chapNum;

    // Bước 1: Lấy HTML trang chương để trích chapterHandle từ RSC (__next_f) data
    var pageResp = fetch(chapUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "vi-VN,vi;q=0.9,en;q=0.8"
        }
    });
    if (!pageResp || !pageResp.ok) return Response.error(chapUrl);

    var doc = pageResp.html("utf-8");
    if (!doc) return Response.error(chapUrl);
    var pageHtml = doc.html() || "";

    // chapterHandle nằm trong __next_f script dạng: \"chapterHandle\":\"rh1.xxx\"
    var handleMatch = pageHtml.match(/\\"chapterHandle\\":\\"(rh1\.[^"\\]+)/)
                   || pageHtml.match(/"chapterHandle":"(rh1\.[^"]+)"/);
    if (!handleMatch) return Response.error(chapUrl);
    var chapterHandle = handleMatch[1];

    // Bước 2: Lấy cookie session từ plugin WebView
    var cookieStr = getSessionCookies();

    if (!cookieStr) {
        // Chưa có cookie → tự động mở trình duyệt để người dùng đăng nhập
        cookieStr = doLogin(chapUrl);
        if (!cookieStr) return Response.error(LOGIN_MSG);
    }

    // Trích giá trị cookie aitruyen_bff_proof để dùng làm header bảo mật
    var bffProof = "";
    var bffMatch = cookieStr.match(/(?:^|;)\s*aitruyen_bff_proof=([^;]+)/);
    if (bffMatch) {
        try { bffProof = decodeURIComponent(bffMatch[1].trim()); }
        catch (e) { bffProof = bffMatch[1].trim(); }
    }

    // Bước 3: Gọi API nội dung chương
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

    var apiResp = fetch(contentUrl, {
        method: "POST",
        headers: apiHeaders,
        body: "{}"
    });

    if (!apiResp || !apiResp.ok) {
        // Có thể session hết hạn → mở lại trình duyệt để đăng nhập lại
        cookieStr = doLogin(chapUrl);
        if (!cookieStr) return Response.error(LOGIN_MSG);

        // Cập nhật cookie và thử lại
        bffProof = "";
        var bffMatch2 = cookieStr.match(/(?:^|;)\s*aitruyen_bff_proof=([^;]+)/);
        if (bffMatch2) {
            try { bffProof = decodeURIComponent(bffMatch2[1].trim()); }
            catch (e) { bffProof = bffMatch2[1].trim(); }
        }
        apiHeaders["cookie"] = cookieStr;
        if (bffProof) apiHeaders["x-aitruyen-browser-proof"] = bffProof;

        apiResp = fetch(contentUrl, {
            method: "POST",
            headers: apiHeaders,
            body: "{}"
        });
        if (!apiResp || !apiResp.ok) return Response.error(LOGIN_MSG);
    }

    var json = apiResp.json();
    if (!json) return Response.error(chapUrl);

    if (json.status === "requires_auth") {
        // API từ chối auth → mở trình duyệt đăng nhập lại
        cookieStr = doLogin(chapUrl);
        if (!cookieStr) return Response.error(LOGIN_MSG);

        var bffProof3 = "";
        var bffMatch3 = cookieStr.match(/(?:^|;)\s*aitruyen_bff_proof=([^;]+)/);
        if (bffMatch3) {
            try { bffProof3 = decodeURIComponent(bffMatch3[1].trim()); }
            catch (e) { bffProof3 = bffMatch3[1].trim(); }
        }
        apiHeaders["cookie"] = cookieStr;
        if (bffProof3) apiHeaders["x-aitruyen-browser-proof"] = bffProof3;
        else delete apiHeaders["x-aitruyen-browser-proof"];

        var retryResp = fetch(contentUrl, {
            method: "POST",
            headers: apiHeaders,
            body: "{}"
        });
        if (!retryResp || !retryResp.ok) return Response.error(LOGIN_MSG);
        json = retryResp.json();
        if (!json || json.status === "requires_auth") return Response.error(LOGIN_MSG);
    }

    var contentHtml = json.contentHtml;
    if (!contentHtml || String(contentHtml).trim().length < 10) return Response.error(chapUrl);

    return Response.success(String(contentHtml));
}

