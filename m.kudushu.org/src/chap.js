var HOST = "https://m.kudushu.org";

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
        var doc = browser.launch(url, 25000);
        if (isBlocked(doc)) {
            sleep(4000);
            doc = browser.launch(url, 25000);
        }
        return isBlocked(doc) ? null : doc;
    } catch (e) {
        Console.log("kudushu chapter: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
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

    var currentUrl = firstUrl;
    var content = "";
    var seen = {};
    var guard = 0;

    while (currentUrl && !seen[currentUrl] && guard < 20) {
        seen[currentUrl] = true;
        guard++;

        var doc = loadDoc(currentUrl, firstUrl);
        if (!doc) break;

        var contentElement = doc.select("#novelcontent, .novelcontent, #chaptercontent, .chapter-content").first();
        var html = contentElement ? cleanContent(contentElement.html()) : "";
        if (!html) break;
        content += (content ? "<br><br>" : "") + html;

        var nextUrl = findNextPage(doc, currentUrl, basePath);
        if (!nextUrl) break;
        sleep(800);
        currentUrl = nextUrl;
    }

    return content ? Response.success(content) : null;
}
