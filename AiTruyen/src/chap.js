// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// AiTruyen dùng Next.js React Server Components (RSC/__next_f).
// Nội dung chương lấy qua API: POST /api/chapters/{encodeURIComponent(chapterHandle)}/content
// chapterHandle được nhúng trong __next_f RSC data của trang HTML.
// API yêu cầu cookie session (người dùng phải đăng nhập qua nút "Mở trang nguồn").

var HOST = "https://aitruyen.net";

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

    // Bước 2: Lấy cookie session từ webview (người dùng đã đăng nhập aitruyen.net)
    var cookieStr = "";
    try {
        var c = localCookie.getCookie();
        if (c && String(c).length > 5) cookieStr = String(c);
    } catch (e) {}

    if (!cookieStr) {
        // Chưa có cookie - hiện nút mở trang nguồn để người dùng đăng nhập
        return Response.error(chapUrl);
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

    if (!apiResp || !apiResp.ok) return Response.error(chapUrl);

    var json = apiResp.json();
    if (!json) return Response.error(chapUrl);

    if (json.status === "requires_auth") return Response.error(chapUrl);

    var contentHtml = json.contentHtml;
    if (!contentHtml || String(contentHtml).trim().length < 10) return Response.error(chapUrl);

    return Response.success(String(contentHtml));
}
