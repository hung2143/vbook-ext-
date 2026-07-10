var HOST = "https://m.kudushu.org";
var COVER_HOST = "https://www.kudushu.org";
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

function getBookId(url) {
    var match = String(url || "").match(/\/(?:book|html)\/(\d+)/i);
    return match ? match[1] : "";
}

function toBookUrl(link) {
    var id = getBookId(link);
    return id ? HOST + "/book/" + id + "/" : toUrl(link);
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
        Console.log("kudushu book: waiting for Cloudflare (" + (i + 1) + "/" + CHALLENGE_RETRIES + ")");
        sleep(CHALLENGE_WAIT + i * 4000);

        // Keep the same WebView: Cloudflare binds its clearance to this session.
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
        Console.log("kudushu book: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
    }
}

function firstBookAnchor(item) {
    var anchor = item.select("h1 a, h2 a, h3 a, h4 a, h5 a, h6 a, .bookname a, .p2 a").first();
    if (anchor && getBookId(anchor.attr("href") || "")) return anchor;

    anchor = null;
    item.select("a[href*='/book/'], a[href*='/html/']").forEach(function(a) {
        if (!anchor && getBookId(a.attr("href") || "")) anchor = a;
    });
    return anchor;
}

function selectText(item, selector) {
    var element = item.select(selector).first();
    return element ? cleanText(element.text()) : "";
}

function itemDescription(item, title) {
    var author = selectText(item, ".author, .p3, [class*='author']");
    author = author.replace(/^作者[：:]\s*/, "");

    var category = selectText(item, ".p1, .category, .type, .tag");
    category = category.replace(/[\[\]]/g, "");

    var description = selectText(item, ".simple, .description, .desc, .intro, .update");
    description = description.replace(/^(?:简介|本书简介)[：:]\s*/, "");
    if (description === title) description = "";

    var result = [];
    if (category) result.push(category);
    if (author) result.push(author);
    if (description) result.push(description);
    return result.join(" - ");
}

function addItem(item, data, seen) {
    var anchor = firstBookAnchor(item);
    if (!anchor) return;

    var href = anchor.attr("href") || "";
    var bookId = getBookId(href);
    var link = toBookUrl(href);
    var name = cleanText(anchor.text());
    if (!bookId || !link || !name || name.length < 2 || seen[link]) return;

    var image = item.select("img[data-src], img[data-original], img[src]").first();
    var cover = image ? toUrl(image.attr("data-src") || image.attr("data-original") || image.attr("src")) : "";
    if (!cover) cover = buildCover(bookId);

    seen[link] = true;
    data.push({
        name: name,
        link: link,
        host: HOST,
        cover: cover,
        description: itemDescription(item, name)
    });
}

function parseBooks(doc) {
    var data = [];
    var seen = {};
    var itemSelector = ".article, .articlegeneral, .bookbox, .book-list li, .booklist li, .list-item";

    doc.select(itemSelector).forEach(function(item) {
        addItem(item, data, seen);
    });

    if (!data.length) {
        doc.select("li, tr").forEach(function(item) {
            addItem(item, data, seen);
        });
    }

    if (!data.length) {
        doc.select("a[href*='/book/'], a[href*='/html/']").forEach(function(anchor) {
            var href = anchor.attr("href") || "";
            var bookId = getBookId(href);
            var link = toBookUrl(href);
            var name = cleanText(anchor.text());
            if (!bookId || !link || !name || name.length < 2 || seen[link]) return;
            seen[link] = true;
            data.push({
                name: name,
                link: link,
                host: HOST,
                cover: buildCover(bookId),
                description: ""
            });
        });
    }

    return data;
}

function pageNumber(url) {
    var match = String(url || "").replace(/[?#].*$/, "").match(/\/(?:asc-)?(\d+)(?:\.html|\/)?$/);
    return match ? parseInt(match[1], 10) : 0;
}

function withPage(url, page) {
    var clean = String(url || "");
    if (!page || parseInt(page, 10) <= 1) return clean;
    if (/\/(?:asc-)?\d+(?:\.html|\/)?(?:[?#].*)?$/i.test(clean)) {
        return clean.replace(/\/(?:asc-)?\d+(\.html|\/)?(?=([?#].*)?$)/i, "/" + page + "$1");
    }
    return clean;
}

function findNextPage(doc, currentUrl) {
    var current = pageNumber(currentUrl);
    var next = 0;

    doc.select("a[href]").forEach(function(a) {
        if (next) return;
        var label = cleanText(a.text()).replace(/\s/g, "");
        var rel = (a.attr("rel") || "").toLowerCase();
        if (label !== "下页" && label !== "下一页" && label !== "下一頁" && label !== "»" && rel !== "next") return;

        var candidate = pageNumber(toUrl(a.attr("href") || "", currentUrl));
        if (candidate && candidate > current) next = candidate;
    });

    return next ? String(next) : null;
}

function execute(url, page) {
    var targetUrl = withPage(toUrl(url), page);
    var doc = loadDoc(targetUrl);
    if (!doc) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");

    return Response.success(parseBooks(doc), findNextPage(doc, targetUrl));
}
