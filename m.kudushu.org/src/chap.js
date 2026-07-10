var HOST = "https://m.kudushu.org";
var BROWSER_TIMEOUT = 15000;
var CHALLENGE_RETRIES = 2;
var CHALLENGE_WAIT = 8000;

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

function loadWithBrowser(browser, url) {
    var doc = browser.launch(url, BROWSER_TIMEOUT);

    for (var i = 0; i < CHALLENGE_RETRIES && isBlocked(doc); i++) {
        Console.log("kudushu chapter: waiting for Cloudflare (" + (i + 1) + "/" + CHALLENGE_RETRIES + ")");
        sleep(CHALLENGE_WAIT + i * 4000);
        try { doc = browser.html(); } catch (ignore) {}
        if (!isBlocked(doc)) break;
        doc = browser.launch(url, BROWSER_TIMEOUT);
    }

    return isBlocked(doc) ? null : doc;
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
        .replace(/&nbsp;/gi, " ")
        .trim();
}

function chapterBase(url) {
    var match = String(url || "").match(/(\/html\/\d+\/\d+)(?:_\d+)?\/?(?:[?#].*)?$/i);
    return match ? match[1] : "";
}

function findNextPage(doc, currentUrl, basePath) {
    var nextUrl = "";
    doc.select("a[href]").forEach(function(a) {
        if (nextUrl) return;
        var label = cleanText(a.text()).replace(/\s/g, "");
        var rel = (a.attr("rel") || "").toLowerCase();
        if (label !== "下页" && label !== "下一页" && label !== "下一頁" && label !== "»" && rel !== "next") return;

        var candidate = toUrl(a.attr("href") || "", currentUrl).replace(/[?#].*$/, "");
        if (candidate.indexOf(HOST + basePath + "_") === 0) nextUrl = candidate;
    });
    return nextUrl;
}

function execute(url) {
    var firstUrl = toUrl(url);
    var basePath = chapterBase(firstUrl);
    if (!basePath) return null;

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());

        var currentUrl = firstUrl;
        var content = "";
        var seen = {};
        var guard = 0;
        var wasBlocked = false;

        while (currentUrl && !seen[currentUrl] && guard < 20) {
            seen[currentUrl] = true;
            guard++;

            var doc = loadDoc(currentUrl, firstUrl, browser);
            if (!doc) {
                wasBlocked = true;
                break;
            }

            var contentElement = doc.select("#novelcontent, .novelcontent, #chaptercontent, .chapter-content").first();
            var html = contentElement ? cleanContent(contentElement.html()) : "";
            if (!html) break;
            content += (content ? "<br><br>" : "") + html;

            var nextUrl = findNextPage(doc, currentUrl, basePath);
            if (!nextUrl) break;
            sleep(800);
            currentUrl = nextUrl;
        }

        if (content) return Response.success(content);
        if (wasBlocked) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");
        return Response.error("Không tìm thấy nội dung chương trên Kudushu.");
    } finally {
        try { browser.close(); } catch (ignore) {}
    }
}
