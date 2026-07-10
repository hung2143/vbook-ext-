var HOST = "https://sto55.com";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    return HOST + (link.indexOf("/") === 0 ? link : "/" + link);
}

function buildCoverUrl(bookId) {
    var id = parseInt(bookId, 10);
    if (isNaN(id)) return "";
    return HOST + "/files/article/image/" + Math.floor(id / 1000) + "/" + id + "/" + id + "s.jpg";
}

function isBlocked(doc) {
    var text = doc ? (doc.text() || "") : "";
    return text.indexOf("\u8bbf\u95ee\u592a\u9891\u7e41") !== -1 ||
        text.indexOf("\u8acb\u7a0d\u5f8c") !== -1 ||
        text.indexOf("Just a moment") !== -1;
}

function fetchSearchPage(url) {
    for (var i = 0; i < 2; i++) {
        try {
            var response = fetch(url, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (response && response.ok) {
                var doc = response.html();
                if (!isBlocked(doc)) return doc;
                Console.log("search: request was rate limited");
            }
        } catch (e) {
            Console.log("search: fetch attempt " + (i + 1) + " failed: " + e);
        }
        sleep(1500 * (i + 1));
    }
    return null;
}

function browserFetch(url) {
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 25000);
        return isBlocked(doc) ? null : doc;
    } catch (e) {
        Console.log("search: browser fallback failed: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function parseSearchResults(doc) {
    var data = [];
    var seen = {};

    doc.select(".bookbox").forEach(function(box) {
        var nameEl = box.select(".bookname a").first();
        if (!nameEl) return;

        var href = nameEl.attr("href") || "";
        var idMatch = href.match(/\/book\/(\d+)/);
        if (!idMatch) return;

        var link = normalizeUrl(href);
        if (seen[link]) return;
        seen[link] = true;

        var name = nameEl.text().trim();
        if (!name) return;

        var author = "";
        var authorEl = box.select(".author a").first();
        if (authorEl) author = authorEl.text().trim();

        var description = "";
        var introEl = box.select(".update").first();
        if (introEl) {
            description = introEl.text().replace(/^\u7c21\u4ecb[\uff1a:]\s*/, "")
                .replace(/^\u7b80\u4ecb[\uff1a:]\s*/, "").trim();
        }

        data.push({
            name: name,
            link: link,
            host: HOST,
            cover: buildCoverUrl(idMatch[1]),
            description: author ? (author + (description ? " - " + description : "")) : description
        });
    });

    return data;
}

function parseRedirectedBook(doc) {
    var nameEl = doc.select("h1").first();
    var name = nameEl ? nameEl.text().trim() : "";
    var link = doc.select("link[rel='canonical']").attr("href") ||
        doc.select("meta[property='og:url']").attr("content") || "";
    var idMatch = link.match(/\/book\/(\d+)/);
    if (!name || !idMatch) return [];

    var authorEl = doc.select(".author a, .author").first();
    var author = authorEl ? authorEl.text().replace(/^\u4f5c\u8005[\uff1a:]\s*/, "").trim() : "";
    var introEl = doc.select(".intro, #intro, [class*='intro']").first();
    var description = introEl ? introEl.text().trim() : "";

    return [{
        name: name,
        link: normalizeUrl(link),
        host: HOST,
        cover: buildCoverUrl(idMatch[1]),
        description: author ? (author + (description ? " - " + description : "")) : description
    }];
}

function findNextPage(doc, currentPage) {
    var nextLink = doc.select("a.next[href]").first();
    if (!nextLink) return null;

    var match = (nextLink.attr("href") || "").match(/\/(\d+)\.html(?:[?#].*)?$/);
    if (!match) return null;

    var nextPage = parseInt(match[1], 10);
    return nextPage > currentPage ? String(nextPage) : null;
}

function execute(key, page) {
    var pageNum = parseInt(page || "1", 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    key = (key || "").trim();
    if (!key) return Response.success([], null);

    var searchUrl = HOST + "/search/" + encodeURIComponent(key) + "/" + pageNum + ".html";
    Console.log("search: fetching " + searchUrl);

    // The site's public GET URL is more reliable in VBook than the HTML form POST.
    var doc = fetchSearchPage(searchUrl);
    if (!doc) doc = browserFetch(searchUrl);
    if (!doc) return Response.success([], null);

    var data = parseSearchResults(doc);
    if (data.length === 0) data = parseRedirectedBook(doc);

    Console.log("search: parsed " + data.length + " results");
    return Response.success(data, findNextPage(doc, pageNum));
}
