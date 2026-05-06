var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function extractBookId(href) {
    var m = href.match(/\/html\/(\d+)\//);
    return m ? m[1] : "";
}

function execute(key, page) {
    if (!key) return Response.success([]);
    var searchUrl = HOST + "/modules/article/search.php?searchkey=" + encodeURIComponent(key);

    // Strategy 1: Browser (bypass anti-bot)
    var doc = null;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        doc = browser.launch(searchUrl, 15000);
        browser.close();
    } catch (e) {
        Console.log("search browser error: " + e);
        try { browser.close(); } catch (e2) {}
    }

    // Strategy 2: Fallback to fetch
    if (!doc) {
        var response = fetch(searchUrl, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/"
            }
        });
        if (response.ok) doc = response.html();
    }

    if (!doc) return null;

    var data = [];
    var seen = {};

    doc.select(".searchresult a[href*='/html/']").forEach(function(a) {
        var href = a.attr("href") || "";
        var bookId = extractBookId(href);
        if (!bookId) return;

        var title = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!title) return;

        var link = HOST + "/book/" + bookId + "/";
        if (seen[link]) return;
        seen[link] = true;

        data.push({
            name: title,
            link: link,
            host: HOST,
            cover: "",
            description: ""
        });
    });

    // Fallback: try broader selectors if searchresult not found
    if (data.length === 0) {
        doc.select("a[href*='/html/']").forEach(function(a) {
            var href = a.attr("href") || "";
            var bookId = extractBookId(href);
            if (!bookId) return;

            var title = (a.text() || "").replace(/\s+/g, " ").trim();
            if (!title || title.length < 2) return;

            var link = HOST + "/book/" + bookId + "/";
            if (seen[link]) return;
            seen[link] = true;

            data.push({
                name: title,
                link: link,
                host: HOST,
                cover: "",
                description: ""
            });
        });
    }

    return Response.success(data);
}
