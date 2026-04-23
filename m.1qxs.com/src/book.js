var HOST = "https://m.1qxs.com";

function execute(url, page) {
    var targetUrl = url;
    if (page) {
        // Replace page number in URL
        targetUrl = url.replace(/\/\d+\.html$/, "/" + page + ".html");
    }

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(targetUrl, 15000);

        if (!doc) {
            var response = fetch(targetUrl, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept-language": "zh-CN,zh;q=0.9"
                }
            });
            if (!response.ok) return null;
            doc = response.html();
        }

        if (!doc) return null;

        var data = [];
        // Book list items
        doc.select(".list-item, .book-item, li a[href*='/xs_1/']").forEach(function(e) {
            var link = e.attr("href") || "";
            if (!link) {
                var linkEl = e.select("a[href*='/xs_1/']").first();
                if (linkEl) link = linkEl.attr("href");
            }
            if (!link || !link.match(/\/xs_1\/\d+/)) return;

            var name = e.select("h4, h3, .title, .name").text() || e.text();
            name = name.trim();
            if (!name) return;

            var cover = "";
            var img = e.select("img").first();
            if (img) {
                cover = img.attr("data-src") || img.attr("src") || "";
                if (cover.startsWith("//")) cover = "https:" + cover;
                if (cover && !cover.startsWith("http")) cover = HOST + cover;
            }

            var desc = e.select(".desc, .intro, p").text() || "";

            data.push({
                name: name,
                link: link,
                host: HOST,
                cover: cover,
                description: desc.trim()
            });
        });

        // Find next page
        var next = null;
        var pageMatch = targetUrl.match(/\/(\d+)\.html$/);
        if (pageMatch) {
            var currentPage = parseInt(pageMatch[1]);
            next = currentPage + 1;
            // Check if there's actually a next page link
            var hasNext = false;
            doc.select("a").forEach(function(a) {
                var text = a.text();
                if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1 || text.indexOf("»") !== -1) {
                    hasNext = true;
                }
            });
            if (!hasNext) next = null;
        }

        browser.close();
        return Response.success(data, next);
    } catch (e) {
        Console.log("book.js error: " + e);
        try { browser.close(); } catch(e2) {}
        return null;
    }
}