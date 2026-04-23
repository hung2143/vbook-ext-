var HOST = "https://m.1qxs.com";

function execute(url, page) {
    var targetUrl = url;
    if (page) {
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
        doc.select("a[href*='/xs_1/']").forEach(function(e) {
            var link = e.attr("href") || "";
            if (!link.match(/\/xs_1\/\d+/)) return;

            var name = e.select("h4, h3, .title, .name").text() || e.text();
            name = name.trim();
            if (!name || name.length < 2) return;

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

        // Deduplicate
        var seen = {};
        var unique = [];
        for (var i = 0; i < data.length; i++) {
            if (!seen[data[i].link]) {
                seen[data[i].link] = true;
                unique.push(data[i]);
            }
        }

        // Next page
        var next = null;
        var pageMatch = targetUrl.match(/\/(\d+)\.html$/);
        if (pageMatch) {
            var currentPage = parseInt(pageMatch[1]);
            next = currentPage + 1;
            var hasNext = false;
            doc.select("a").forEach(function(a) {
                var text = a.text();
                if (text.indexOf("下一页") !== -1 || text.indexOf("»") !== -1) {
                    hasNext = true;
                }
            });
            if (!hasNext) next = null;
        }

        browser.close();
        return Response.success(unique, next);
    } catch (e) {
        Console.log("gen error: " + e);
        try { browser.close(); } catch(e2) {}
        return null;
    }
}