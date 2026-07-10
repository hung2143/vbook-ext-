var HOST = "https://m.kudushu.org";
var BROWSER_TIMEOUT = 12000;

function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}

function toUrl(link, baseUrl) {
    link = cleanText(link);
    if (!link || /^javascript:|^#/i.test(link)) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (/^https?:/i.test(link)) return link.replace(/^http:\/\//i, "https://");
    if (link.charAt(0) === "/") return HOST + link;
    baseUrl = (baseUrl || HOST + "/").replace(/[?#].*$/, "");
    return baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1) + link;
}

function getBookId(url) {
    var match = String(url || "").match(/\/(?:book|html)\/(\d+)/i);
    return match ? match[1] : "";
}

function normalBookUrl(url) {
    var id = getBookId(url);
    return id ? HOST + "/book/" + id + "/" : "";
}

function isBlocked(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    return /Just a moment|Checking your browser|Enable JavaScript and cookies|cf[-_]chl|challenges\.cloudflare\.com/i.test(text);
}

function loadDoc(url, referer) {
    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": referer || HOST + "/",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "zh-CN,zh;q=0.9"
            }
        });
        if (response && response.ok) {
            var fetched = response.html();
            if (!isBlocked(fetched)) return fetched;
        }
    } catch (ignore) {}

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, BROWSER_TIMEOUT);
        return isBlocked(doc) ? null : doc;
    } catch (e) {
        Console.log("kudushu toc: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
    }
}

function isChapterUrl(href, bookId) {
    return new RegExp("/html/" + bookId + "/\\d+(?:_\\d+)?/?(?:[?#].*)?$", "i").test(href || "");
}

function addLinks(links, bookId, baseUrl, data, seen) {
    links.forEach(function(a) {
        var href = a.attr("href") || "";
        if (!isChapterUrl(href, bookId)) return;
        var chapterUrl = toUrl(href, baseUrl);
        var name = cleanText(a.text());
        if (!chapterUrl || !name || seen[chapterUrl]) return;
        seen[chapterUrl] = true;
        data.push({ name: name, url: chapterUrl, host: HOST });
    });
}

function addChapters(doc, bookId, baseUrl, data, seen) {
    var selectors = [
        "#chapterlist a", "#catalog a", ".chapterlist a", ".chapter-list a",
        ".cataloglist a", ".catalog-list a", ".article_list a", ".chapter a"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var links = doc.select(selectors[i]);
        var before = data.length;
        addLinks(links, bookId, baseUrl, data, seen);
        if (data.length > before) return;
    }

    // Older mobile templates do not label the chapter container.  Their chapter
    // links are still unambiguous by URL, so retain this final compatibility path.
    addLinks(doc.select("a[href*='/html/" + bookId + "/']"), bookId, baseUrl, data, seen);
}

function pageIndex(url) {
    var match = String(url || "").match(/\/asc-(\d+)\/?(?:[?#].*)?$/i);
    return match ? parseInt(match[1], 10) : 0;
}

function collectPages(doc, bookId, baseUrl) {
    var pages = [];
    var seen = {};

    function add(value) {
        var pageUrl = toUrl(value, baseUrl);
        if (!pageUrl || !new RegExp("/html/" + bookId + "/asc-\\d+/?(?:[?#].*)?$", "i").test(pageUrl)) return;
        if (seen[pageUrl]) return;
        seen[pageUrl] = true;
        pages.push(pageUrl);
    }

    doc.select("select[name='pageselect'] option, .pageselect option").forEach(function(option) {
        add(option.attr("value") || "");
    });
    doc.select("a[href*='/html/" + bookId + "/asc-']").forEach(function(a) {
        add(a.attr("href") || "");
    });

    pages.sort(function(left, right) { return pageIndex(left) - pageIndex(right); });
    return pages;
}

function execute(url) {
    var bookId = getBookId(url);
    var baseUrl = normalBookUrl(url);
    if (!bookId || !baseUrl) return null;

    var doc = loadDoc(baseUrl, HOST + "/");
    if (!doc) return null;

    var data = [];
    var seen = {};
    addChapters(doc, bookId, baseUrl, data, seen);

    var pages = collectPages(doc, bookId, baseUrl);
    for (var i = 0; i < pages.length; i++) {
        if (pages[i] === baseUrl || pageIndex(pages[i]) <= 1) continue;
        sleep(1200);
        var pageDoc = loadDoc(pages[i], baseUrl);
        if (pageDoc) addChapters(pageDoc, bookId, pages[i], data, seen);
    }

    return Response.success(data);
}
