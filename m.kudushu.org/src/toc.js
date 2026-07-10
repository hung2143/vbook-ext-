var HOST = "https://m.kudushu.org";
var DESKTOP_HOST = "https://www.kudushu.org";
var BROWSER_TIMEOUT = 1500;
var BROWSER_POLL_INTERVAL = 500;
var BROWSER_POLL_LIMIT = 18;

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
    url = String(url || "");
    var desktop = url.match(/\/html\/(\d+)\/(\d+)(?:\/|$)/i);
    if (desktop && Math.floor(parseInt(desktop[2], 10) / 1000) === parseInt(desktop[1], 10)) {
        return desktop[2];
    }
    var mobile = url.match(/\/(?:book|html)\/(\d+)/i);
    return mobile ? mobile[1] : "";
}

function normalBookUrl(url) {
    var id = getBookId(url);
    return id ? HOST + "/book/" + id + "/" : "";
}

function desktopBookUrl(bookId) {
    var id = parseInt(bookId, 10);
    if (isNaN(id)) return "";
    return DESKTOP_HOST + "/html/" + Math.floor(id / 1000) + "/" + id + "/";
}

function isBlocked(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    var html = "";
    try { html = doc.html() || ""; } catch (ignore) {}
    return /Just a moment|Checking your browser|Performing security verification|Verify you are human|Enable JavaScript and cookies|Cloudflare Ray ID|cf[-_]chl|challenges\.cloudflare\.com|cf-turnstile-response/i.test(text + " " + html);
}

function isReady(doc) {
    if (!doc || isBlocked(doc)) return false;
    try { return (doc.html() || "").length > 200; } catch (ignore) { return false; }
}

function loadWithBrowser(browser, url) {
    var doc = browser.launch(url, BROWSER_TIMEOUT);

    if (isReady(doc)) return doc;
    Console.log("kudushu toc: waiting for Cloudflare clearance");

    for (var i = 0; i < BROWSER_POLL_LIMIT; i++) {
        sleep(BROWSER_POLL_INTERVAL);
        try { doc = browser.html(); } catch (ignore) {}
        if (isReady(doc)) return doc;
    }

    return null;
}

function loadDoc(url, referer, browser) {
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

    try {
        return loadWithBrowser(browser, url);
    } catch (e) {
        Console.log("kudushu toc: " + e);
        return null;
    }
}

function chapterId(href, bookId) {
    href = String(href || "").replace(/[?#].*$/, "");

    var mobile = href.match(new RegExp("/html/" + bookId + "/(\\d+)(?:_\\d+)?/?$", "i"));
    if (mobile) return parseInt(mobile[1], 10);

    var desktop = href.match(new RegExp("/html/\\d+/" + bookId + "/(\\d+)\\.html$", "i"));
    return desktop ? parseInt(desktop[1], 10) : 0;
}

function canonicalChapterUrl(bookId, id) {
    return id ? HOST + "/html/" + bookId + "/" + id + "/" : "";
}

function isDesktopChapterUrl(url, bookId) {
    return new RegExp("/html/\\d+/" + bookId + "/\\d+\\.html(?:[?#].*)?$", "i").test(url || "");
}

function addLinks(links, bookId, baseUrl, data, seen, desktopOnly) {
    links.forEach(function(a) {
        var href = a.attr("href") || "";
        var resolvedUrl = toUrl(href, baseUrl);
        if (desktopOnly && !isDesktopChapterUrl(resolvedUrl, bookId)) return;
        var id = chapterId(resolvedUrl, bookId);
        var chapterUrl = canonicalChapterUrl(bookId, id);
        var name = cleanText(a.text());
        if (!chapterUrl || !name || seen[chapterUrl]) return;
        seen[chapterUrl] = true;
        data.push({ name: name, url: chapterUrl, host: HOST, order: id });
    });
}

function addDesktopChapters(doc, bookId, baseUrl, data, seen) {
    addLinks(doc.select("a[href]"), bookId, baseUrl, data, seen, true);
}

function addChapters(doc, bookId, baseUrl, data, seen) {
    var selectors = [
        "#chapterlist a", "#catalog a", ".chapterlist a", ".chapter-list a",
        ".cataloglist a", ".catalog-list a", ".article_list a", ".chapter a"
    ];

    for (var i = 0; i < selectors.length; i++) {
        addLinks(doc.select(selectors[i]), bookId, baseUrl, data, seen);
    }

    // Older mobile templates do not label the chapter container.  Their chapter
    // links are still unambiguous by URL. Always scan them too: some templates
    // put the latest preview and the main catalog in different containers.
    addLinks(doc.select("a[href*='" + bookId + "/']"), bookId, baseUrl, data, seen);
}

function sortChapters(data) {
    data.sort(function(left, right) {
        return (left.order || chapterId(left.url, getBookId(left.url))) -
            (right.order || chapterId(right.url, getBookId(right.url)));
    });

    data.forEach(function(chapter) { delete chapter.order; });
    return data;
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

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());

        // The desktop catalog contains all chapters on one page. This avoids
        // loading one mobile asc-* page for every group of 20 chapters.
        var desktopUrl = desktopBookUrl(bookId);
        var desktopDoc = loadDoc(desktopUrl, DESKTOP_HOST + "/", browser);
        var data = [];
        var seen = {};
        if (desktopDoc) addDesktopChapters(desktopDoc, bookId, desktopUrl, data, seen);
        if (data.length) return Response.success(sortChapters(data));

        var doc = loadDoc(baseUrl, HOST + "/", browser);
        if (!doc) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");

        addChapters(doc, bookId, baseUrl, data, seen);

        var pages = collectPages(doc, bookId, baseUrl);
        for (var i = 0; i < pages.length; i++) {
            if (pages[i] === baseUrl || pageIndex(pages[i]) <= 1) continue;
            sleep(200);
            var pageDoc = loadDoc(pages[i], baseUrl, browser);
            if (pageDoc) addChapters(pageDoc, bookId, pages[i], data, seen);
        }

        return Response.success(sortChapters(data));
    } finally {
        try { browser.close(); } catch (ignore) {}
    }
}
