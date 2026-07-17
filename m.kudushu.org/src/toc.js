var HOST = "https://m.kudushu.org";
var DESKTOP_HOST = "https://www.kudushu.org";
var BROWSER_TIMEOUT = 1500;
var BROWSER_POLL_INTERVAL = 500;
var BROWSER_POLL_LIMIT = 18;
var MOBILE_PAGE_THRESHOLD = 6;

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

function ensureBrowser(session) {
    if (session.browser) return session.browser;
    session.browser = Engine.newBrowser();
    session.browser.setUserAgent(UserAgent.android());
    return session.browser;
}

function loadDoc(url, referer, session) {
    // Once a direct request is blocked, do not repeat it for every catalog
    // page. Keep using the same browser so its Cloudflare clearance is reused.
    if (!session.browserOnly) {
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
        session.browserOnly = true;
    }

    try {
        return loadWithBrowser(ensureBrowser(session), url);
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

function mobilePagesAfterFirst(pages, baseUrl) {
    var result = [];
    for (var i = 0; i < pages.length; i++) {
        if (pages[i] === baseUrl || pageIndex(pages[i]) <= 1) continue;
        result.push(pages[i]);
    }
    return result;
}

function loadMobilePages(pages, bookId, baseUrl, session, data, seen) {
    for (var i = 0; i < pages.length; i++) {
        var pageDoc = loadDoc(pages[i], baseUrl, session);
        if (pageDoc) addChapters(pageDoc, bookId, pages[i], data, seen);
    }
}

function execute(url) {
    var bookId = getBookId(url);
    var baseUrl = normalBookUrl(url);
    if (!bookId || !baseUrl) return null;

    var session = { browser: null, browserOnly: false };
    try {
        var data = [];
        var seen = {};

        // Start on the mobile host used by detail.js. Short books can finish
        // here without paying for a separate www-host Cloudflare challenge.
        var mobileDoc = loadDoc(baseUrl, HOST + "/", session);
        if (mobileDoc) {
            addChapters(mobileDoc, bookId, baseUrl, data, seen);
            var mobilePages = mobilePagesAfterFirst(collectPages(mobileDoc, bookId, baseUrl), baseUrl);

            if (mobilePages.length + 1 <= MOBILE_PAGE_THRESHOLD) {
                loadMobilePages(mobilePages, bookId, baseUrl, session, data, seen);
                return Response.success(sortChapters(data));
            }

            // Long books are faster through the one-page desktop catalog.
            // Use a separate result so a partial desktop parse cannot be mixed
            // with the first mobile page.
            var desktopUrl = desktopBookUrl(bookId);
            var desktopDoc = loadDoc(desktopUrl, DESKTOP_HOST + "/", session);
            var desktopData = [];
            var desktopSeen = {};
            if (desktopDoc) addDesktopChapters(desktopDoc, bookId, desktopUrl, desktopData, desktopSeen);
            if (desktopData.length) return Response.success(sortChapters(desktopData));

            // Desktop may be unavailable independently of the mobile host.
            // Fall back to all mobile catalog pages to preserve completeness.
            loadMobilePages(mobilePages, bookId, baseUrl, session, data, seen);
            return Response.success(sortChapters(data));
        }

        // If only the mobile hostname is blocked, the desktop catalog can
        // still provide the complete table of contents.
        var fallbackDesktopUrl = desktopBookUrl(bookId);
        var fallbackDesktopDoc = loadDoc(fallbackDesktopUrl, DESKTOP_HOST + "/", session);
        if (fallbackDesktopDoc) {
            addDesktopChapters(fallbackDesktopDoc, bookId, fallbackDesktopUrl, data, seen);
            if (data.length) return Response.success(sortChapters(data));
        }

        return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");
    } finally {
        if (session.browser) {
            try { session.browser.close(); } catch (ignore) {}
        }
    }
}
