var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function normalizeHost(url) {
    if (!url) return url;
    return url.replace(/https?:\/\/(www\.)?kudushu\.org/i, HOST);
}

function getBookId(url) {
    var m = url.match(/\/book\/(\d+)/);
    if (m) return m[1];
    var m2 = url.match(/\/html\/(\d+)/);
    if (m2) return m2[1];
    return "";
}

function loadDoc(url, referer) {
    // Strategy 1: Browser (bypass anti-bot)
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 15000);
        if (doc) {
            browser.close();
            return doc;
        }
    } catch (e) {
        Console.log("toc browser error: " + e);
    }
    try { browser.close(); } catch (e2) {}

    // Strategy 2: Fallback to fetch
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": referer || HOST + "/"
        }
    });
    if (response.ok) return response.html();
    return null;
}

function addChapters(doc, bookId, data, seen) {
    var selector = "a[href*='/html/" + bookId + "/']";
    doc.select(selector).forEach(function(a) {
        var href = a.attr("href");
        if (!href || !href.match(/\/html\/\d+\/\d+/)) return;
        var name = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!name) return;
        var url = normalizeUrl(href);
        if (seen[url]) return;
        seen[url] = true;
        data.push({ name: name, url: url, host: HOST });
    });
}

function execute(url) {
    url = normalizeHost(url);
    var bookId = getBookId(url);
    if (!bookId) return null;

    var baseUrl = HOST + "/book/" + bookId + "/";
    var doc = loadDoc(baseUrl, HOST + "/");
    if (!doc) return null;

    var data = [];
    var seen = {};

    addChapters(doc, bookId, data, seen);

    var pages = [];
    var select = doc.select("select[name='pageselect']").first();
    if (select) {
        var options = select.select("option");
        for (var i = 0; i < options.size(); i++) {
            var v = options.get(i).attr("value");
            if (v) pages.push(normalizeUrl(v));
        }
    }

    for (var p = 0; p < pages.length; p++) {
        var pageUrl = pages[p];
        if (pageUrl === baseUrl) continue;

        sleep(2000);
        var pageDoc = loadDoc(pageUrl, baseUrl);
        if (!pageDoc) continue;
        addChapters(pageDoc, bookId, data, seen);
    }

    return Response.success(data);
}
