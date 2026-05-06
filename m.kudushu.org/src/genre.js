var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function execute() {
    // Strategy 1: Browser (bypass anti-bot)
    var doc = null;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        doc = browser.launch(HOST + "/modules/article/sortselect.php", 15000);
        browser.close();
    } catch (e) {
        Console.log("genre browser error: " + e);
        try { browser.close(); } catch (e2) {}
    }

    // Strategy 2: Fallback to fetch
    if (!doc) {
        var response = fetch(HOST + "/modules/article/sortselect.php", {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/"
            }
        });
        if (response.ok) doc = response.html();
    }

    if (!doc) return Response.success([]);

    var data = [];
    var seen = {};

    doc.select(".menu_nav a[href*='/sort/']").forEach(function(a) {
        var href = normalizeUrl(a.attr("href"));
        var title = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!href || !title || seen[href]) return;
        seen[href] = true;
        data.push({ title: title, input: href, script: "book.js" });
    });

    // Fallback: try other selectors
    if (data.length === 0) {
        doc.select("a[href*='/sort/']").forEach(function(a) {
            var href = normalizeUrl(a.attr("href"));
            var title = (a.text() || "").replace(/\s+/g, " ").trim();
            if (!href || !title || seen[href]) return;
            seen[href] = true;
            data.push({ title: title, input: href, script: "book.js" });
        });
    }

    return Response.success(data);
}
