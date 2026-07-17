var HOST = "https://m.kudushu.org";
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
    Console.log("kudushu chapter: waiting for Cloudflare clearance");

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
    // Probe direct HTTP while it works. After Cloudflare blocks it, use one
    // browser for all remaining sub-pages instead of repeating the same 403.
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
        Console.log("kudushu chapter: " + e);
        return null;
    }
}

function cleanContent(html) {
    if (!html) return "";
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<div[^>]*(?:id|class)=["'][^"']*(?:content_tip|readtip|chapter-tip|tips)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
        .replace(/(?:最新|最新网址)[^<]{0,100}(?:kudushu\.org)[^<]*/gi, "")
        .replace(/（本章未完[^）]*）/g, "")
        .replace(/\(本章未完[^)]*\)/g, "")
        .replace(/[（(]\s*第\s*\d+\s*\/\s*\d+\s*[页頁]\s*[）)]/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim();
}

function chapterBase(url) {
    var match = String(url || "").match(/(\/html\/\d+\/\d+)(?:_\d+)?\/?(?:[?#].*)?$/i);
    return match ? match[1] : "";
}

function normalizeChapterUrl(url) {
    url = toUrl(url);
    var desktop = String(url || "").match(/\/html\/(\d+)\/(\d+)\/(\d+)\.html(?:[?#].*)?$/i);
    if (desktop && Math.floor(parseInt(desktop[2], 10) / 1000) === parseInt(desktop[1], 10)) {
        return HOST + "/html/" + desktop[2] + "/" + desktop[3] + "/";
    }

    // Opening an imported _2/_3 URL must still return the complete chapter,
    // so always normalize mobile sub-pages back to page 1.
    var mobile = String(url || "").match(/\/html\/(\d+)\/(\d+)(?:_\d+)?\/?(?:[?#].*)?$/i);
    return mobile ? HOST + "/html/" + mobile[1] + "/" + mobile[2] + "/" : url;
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chapterPageNumber(url, basePath) {
    url = String(url || "").replace(/[?#].*$/, "");
    var chapterId = basePath.substring(basePath.lastIndexOf("/") + 1);
    var match = url.match(new RegExp("(?:^|/)" + escapeRegExp(chapterId) + "(?:_(\\d+))?/?$", "i"));
    if (!match) return 0;
    return match[1] ? parseInt(match[1], 10) : 1;
}

function chapterPageUrl(basePath, page) {
    return HOST + basePath + (page > 1 ? "_" + page : "") + "/";
}

function chapterPageCount(doc) {
    var text = doc ? (doc.text() || "") : "";
    var match = text.match(/第\s*\d+\s*\/\s*(\d+)\s*[页頁]/i);
    return match ? parseInt(match[1], 10) : 0;
}

function chapterCurrentPage(doc) {
    var text = doc ? (doc.text() || "") : "";
    var match = text.match(/第\s*(\d+)\s*\/\s*\d+\s*[页頁]/i);
    return match ? parseInt(match[1], 10) : 0;
}

function findNextPage(doc, currentUrl, basePath) {
    var currentPage = chapterPageNumber(currentUrl, basePath) || 1;
    var expectedPage = currentPage + 1;
    var linkedPage = 0;

    // Match the href itself. Kudushu currently labels the button as 下—页,
    // so matching only the visible text incorrectly treats page 1 as complete.
    doc.select("a[href]").forEach(function(a) {
        if (linkedPage) return;
        if (chapterPageNumber(a.attr("href") || "", basePath) === expectedPage) {
            linkedPage = expectedPage;
        }
    });
    if (linkedPage) return chapterPageUrl(basePath, linkedPage);

    // Some templates omit or obfuscate the href but retain (第1/3页).
    // Construct the canonical _2/_3 URL from that page count as a fallback.
    var totalPages = chapterPageCount(doc);
    return totalPages >= expectedPage ? chapterPageUrl(basePath, expectedPage) : "";
}

function execute(url) {
    var firstUrl = normalizeChapterUrl(url);
    var basePath = chapterBase(firstUrl);
    if (!basePath) return null;

    var session = { browser: null, browserOnly: false };
    try {
        var currentUrl = firstUrl;
        var content = "";
        var seen = {};
        var guard = 0;
        var wasBlocked = false;
        var pageFailure = false;
        var loadedPages = 0;
        var totalPages = 0;

        while (currentUrl && !seen[currentUrl] && guard < 20) {
            seen[currentUrl] = true;
            guard++;

            var doc = loadDoc(currentUrl, firstUrl, session);
            if (!doc) {
                wasBlocked = true;
                if (loadedPages > 0) pageFailure = true;
                break;
            }

            var expectedPage = chapterPageNumber(currentUrl, basePath) || 1;
            var actualPage = chapterCurrentPage(doc);
            if (actualPage && actualPage !== expectedPage) {
                pageFailure = true;
                break;
            }

            var contentElement = doc.select("#novelcontent, .novelcontent, #chaptercontent, .chapter-content").first();
            var html = contentElement ? cleanContent(contentElement.html()) : "";
            if (!html) {
                if (loadedPages > 0) pageFailure = true;
                break;
            }
            content += (content ? "<br><br>" : "") + html;
            loadedPages++;

            var detectedTotal = chapterPageCount(doc);
            if (detectedTotal > totalPages) totalPages = detectedTotal;

            var nextUrl = findNextPage(doc, currentUrl, basePath);
            if (!nextUrl) break;
            currentUrl = nextUrl;
        }

        if (pageFailure || (totalPages > 0 && loadedPages < totalPages)) {
            return Response.error("Không thể tải đủ các trang của chương Kudushu. Vui lòng thử lại.");
        }
        if (content) return Response.success(content);
        if (wasBlocked) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");
        return Response.error("Không tìm thấy nội dung chương trên Kudushu.");
    } finally {
        if (session.browser) {
            try { session.browser.close(); } catch (ignore) {}
        }
    }
}
