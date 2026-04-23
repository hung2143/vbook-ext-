var HOST = "https://m.1qxs.com";

function execute(key, page) {
    var searchUrl = HOST + "/s.html?s=" + encodeURIComponent(key);
    if (page) {
        searchUrl += "&page=" + page;
    }

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(searchUrl, 15000);

        if (!doc) {
            var response = fetch(searchUrl, {
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

            var name = e.text().trim();
            if (!name || name.length < 2) return;

            var cover = "";
            var img = e.select("img").first();
            if (img) {
                cover = img.attr("data-src") || img.attr("src") || "";
                if (cover.startsWith("//")) cover = "https:" + cover;
                if (cover && !cover.startsWith("http")) cover = HOST + cover;
            }

            data.push({
                name: name,
                link: link,
                host: HOST,
                cover: cover,
                description: ""
            });
        });

        // Deduplicate by link
        var seen = {};
        var unique = [];
        for (var i = 0; i < data.length; i++) {
            if (!seen[data[i].link]) {
                seen[data[i].link] = true;
                unique.push(data[i]);
            }
        }

        browser.close();
        return Response.success(unique);
    } catch (e) {
        Console.log("search error: " + e);
        try { browser.close(); } catch(e2) {}
        return null;
    }
}