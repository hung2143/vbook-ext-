var HOST = "https://m.kudushu.org";
var COVER_HOST = "https://www.kudushu.org";
var BROWSER_TIMEOUT = 15000;
var CHALLENGE_RETRIES = 2;
var CHALLENGE_WAIT = 8000;

function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}

function toUrl(link) {
    link = cleanText(link);
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (/^https?:/i.test(link)) return link.replace(/^http:\/\//i, "https://");
    return HOST + (link.charAt(0) === "/" ? link : "/" + link);
}

function getBookId(url) {
    var match = String(url || "").match(/\/(?:book|html)\/(\d+)/i);
    return match ? match[1] : "";
}

function buildCover(bookId) {
    var id = parseInt(bookId, 10);
    if (isNaN(id)) return "";
    return COVER_HOST + "/files/article/image/" + Math.floor(id / 1000) + "/" + id + "/" + id + "s.jpg";
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
        Console.log("kudushu search: waiting for Cloudflare (" + (i + 1) + "/" + CHALLENGE_RETRIES + ")");
        sleep(CHALLENGE_WAIT + i * 4000);
        try { doc = browser.html(); } catch (ignore) {}
        if (!isBlocked(doc)) break;
        doc = browser.launch(url, BROWSER_TIMEOUT);
    }

    return isBlocked(doc) ? null : doc;
}

function loadDoc(url) {
    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/",
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
        return loadWithBrowser(browser, url);
    } catch (e) {
        Console.log("kudushu search: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
    }
}

function addResult(anchor, container, data, seen) {
    var href = anchor.attr("href") || "";
    var bookId = getBookId(href);
    var title = cleanText(anchor.text());
    var link = bookId ? HOST + "/book/" + bookId + "/" : "";
    if (!bookId || !title || title.length < 2 || seen[link]) return;

    var description = "";
    if (container) {
        var authorElement = container.select(".author, .p3, [class*='author']").first();
        var typeElement = container.select(".p1, .category, .type").first();
        var author = authorElement ? cleanText(authorElement.text()).replace(/^作者[：:]\s*/, "") : "";
        var type = typeElement ? cleanText(typeElement.text()).replace(/[\[\]]/g, "") : "";
        var parts = [];
        if (type) parts.push(type);
        if (author) parts.push(author);
        description = parts.join(" - ");
    }

    seen[link] = true;
    data.push({
        name: title,
        link: link,
        host: HOST,
        cover: buildCover(bookId),
        description: description
    });
}

function execute(key) {
    key = cleanText(key);
    if (!key) return Response.success([]);

    var doc = loadDoc(HOST + "/modules/article/search.php?searchkey=" + encodeURIComponent(key));
    if (!doc) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");

    var data = [];
    var seen = {};
    doc.select(".searchresult, .articlegeneral, .article, .bookbox, .list-item").forEach(function(item) {
        var anchor = item.select("h1 a, h2 a, h3 a, h4 a, h5 a, h6 a, .bookname a, .p2 a").first();
        if (!anchor || !getBookId(anchor.attr("href") || "")) {
            item.select("a[href*='/book/'], a[href*='/html/']").forEach(function(a) {
                if (!anchor && getBookId(a.attr("href") || "")) anchor = a;
            });
        }
        if (anchor) addResult(anchor, item, data, seen);
    });

    if (!data.length) {
        doc.select("a[href*='/book/'], a[href*='/html/']").forEach(function(anchor) {
            addResult(anchor, null, data, seen);
        });
    }

    return Response.success(data);
}
