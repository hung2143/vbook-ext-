// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// Trang AiTruyen là React/Next.js app:
//   - fetch() trả về HTML shell (không có nội dung)
//   - Cần dùng browser để render → sleep() đợi React hydrate
//   - Sau đó dùng browser.html() → Document object (jsoup)
//   - Dùng doc.select("article.reader-prose") để lấy nội dung sạch
//
// DOM structure (đã debug 2026-04-13):
//   article.reader-prose.rich-content → chứa 71 <p> = nội dung truyện sạch

var HOST = "https://aitruyen.net";

function execute(url) {
    var m = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!m) return null;
    var storySlug = m[1];
    var chapNum = m[2];
    var chapUrl = HOST + "/truyen/" + storySlug + "/chuong-" + chapNum;

    // === Dùng browser render (giống sangtacviet pattern) ===
    var browser = Engine.newBrowser();
    try {
        browser.launch(chapUrl, 30000);

        // Đợi React/Next.js render nội dung chương
        // (trang cần thời gian: load page → hydrate → fetch API nội dung)
        sleep(8000);

        // Lấy DOM đã render → Document object (jsoup)
        var doc = browser.html();

        // === Tìm nội dung truyện ===
        // Selector chính xác: article.reader-prose.rich-content
        var content = doc.select("article.reader-prose");

        if (content.size() == 0) {
            // Fallback: thử các selector khác
            content = doc.select("[class*=rich-content]");
        }

        if (content.size() > 0) {
            // Xóa các element không cần thiết
            content.select("script").remove();
            content.select("style").remove();
            content.select("svg").remove();
            content.select("button").remove();
            content.select("[role=button]").remove();
            content.select("[aria-hidden=true]").remove();

            var html = content.html();
            if (html && html.length() > 50) {
                browser.close();
                return Response.success(html);
            }
        }

        // === Fallback: lấy tất cả <p> trong article bất kỳ ===
        var articles = doc.select("article");
        for (var i = 0; i < articles.size(); i++) {
            var art = articles.get(i);
            var ps = art.select("p");
            if (ps.size() >= 5) {
                var parts = [];
                for (var j = 0; j < ps.size(); j++) {
                    var pHtml = ps.get(j).html();
                    if (pHtml && pHtml.length() > 0) {
                        parts.push("<p>" + pHtml + "</p>");
                    }
                }
                if (parts.length >= 5) {
                    browser.close();
                    return Response.success(parts.join("\n"));
                }
            }
        }

        browser.close();
    } catch (e) {
        try { browser.close(); } catch (_) {}
    }

    return Response.error("Vui lòng đăng nhập tại aitruyen.net trên trình duyệt của ứng dụng, sau đó thử lại.");
}
