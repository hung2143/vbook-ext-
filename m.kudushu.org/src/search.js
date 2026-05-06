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
    if (m) return m[1];
    var m2 = href.match(/\/book\/(\d+)/);
    if (m2) return m2[1];
    return "";
}

function isCloudflare(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    if (text.indexOf("Just a moment") !== -1) return true;
    if (text.indexOf("cf_chl") !== -1) return true;
    if (text.indexOf("Checking your browser") !== -1) return true;
    if (text.indexOf("Enable JavaScript and cookies") !== -1) return true;
    return false;
}

function loadDoc(url) {
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 30000);

        if (isCloudflare(doc)) {
            sleep(10000);
            doc = browser.launch(url, 30000);
        }
        if (isCloudflare(doc)) {
            sleep(15000);
            doc = browser.launch(url, 30000);
        }

        if (doc && !isCloudflare(doc)) {
            browser.close();
            return doc;
        }
    } catch (e) {
        Console.log("search browser error: " + e);
    }
    try { browser.close(); } catch (e2) {}

    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/"
            }
        });
        if (response.ok) {
            var fdoc = response.html();
            if (!isCloudflare(fdoc)) return fdoc;
        }
    } catch (e3) {}

    return null;
}

function execute(key, page) {
    if (!key) return Response.success([]);
    var searchUrl = HOST + "/modules/article/search.php?searchkey=" + encodeURIComponent(key);

    var doc = loadDoc(searchUrl);
    if (!doc) return null;

    var data = [];
    var seen = {};

    // Strategy 1: searchresult links
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

    // Strategy 2: any html links
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

    // Strategy 3: any book links
    if (data.length === 0) {
        doc.select("a[href*='/book/']").forEach(function(a) {
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
