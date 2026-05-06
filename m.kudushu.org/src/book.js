var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function normalizeCover(url) {
    if (!url) return "";
    if (url.indexOf("http://") === 0) return "https://" + url.substring(7);
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http") === 0) return url;
    if (url.indexOf("/") === 0) return HOST + url;
    return HOST + "/" + url;
}

function isCloudflare(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    if (text.indexOf("Just a moment") !== -1) return true;
    if (text.indexOf("cf_chl") !== -1) return true;
    if (text.indexOf("Checking your browser") !== -1) return true;
    if (text.indexOf("Enable JavaScript and cookies") !== -1) return true;
    return false;
}

function loadDoc(url, referer) {
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());

        // First launch with long timeout for Cloudflare challenge
        var doc = browser.launch(url, 30000);

        // Check if still on Cloudflare challenge page
        if (isCloudflare(doc)) {
            Console.log("Cloudflare detected, waiting for challenge...");
            sleep(10000);
            // Re-launch after waiting
            doc = browser.launch(url, 30000);
        }

        // Second check
        if (isCloudflare(doc)) {
            Console.log("Still on Cloudflare, waiting longer...");
            sleep(15000);
            doc = browser.launch(url, 30000);
        }

        if (doc && !isCloudflare(doc)) {
            browser.close();
            return doc;
        }
    } catch (e) {
        Console.log("book browser error: " + e);
    }
    try { browser.close(); } catch (e2) {}

    // Fallback to fetch (unlikely to work with CF but try anyway)
    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": referer || HOST + "/",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "zh-CN,zh;q=0.9"
            }
        });
        if (response.ok) {
            var fdoc = response.html();
            if (!isCloudflare(fdoc)) return fdoc;
        }
    } catch (e3) {}

    return null;
}

function parseArticles(doc) {
    var data = [];

    // Strategy 1: .article items (mobile layout)
    var items = doc.select(".article");
    if (items.size() > 0) {
        items.forEach(function(item) {
            var link = item.select("h6 a").attr("href");
            var name = item.select("h6 a").text();
            if (!link || !name) return;

            var cover = "";
            var img = item.select(".pic img").first();
            if (img) cover = normalizeCover(img.attr("data-src") || img.attr("src"));

            var author = item.select(".author").text().trim();
            var desc = item.select(".simple").text().replace(/\s+/g, " ").trim();

            data.push({
                name: name.trim(),
                link: normalizeUrl(link),
                host: HOST,
                cover: cover,
                description: author ? (author + (desc ? " - " + desc : "")) : desc
            });
        });
        return data;
    }

    // Strategy 2: .articlegeneral items (search result layout)
    doc.select(".articlegeneral").forEach(function(item) {
        var link = item.select(".p2 a").attr("href");
        var name = item.select(".p2 a").text();
        if (!link || !name) return;

        var category = item.select(".p1").text().replace(/[\[\]]/g, "").trim();
        var author = item.select(".p3").text().trim();
        var desc = "";
        if (category) desc += category;
        if (author) desc += (desc ? " - " : "") + author;

        data.push({
            name: name.trim(),
            link: normalizeUrl(link),
            host: HOST,
            cover: "",
            description: desc
        });
    });

    // Strategy 3: Try list-item pattern
    if (data.length === 0) {
        doc.select(".list-item, li.item").forEach(function(item) {
            var a = item.select("a[href*='/book/']").first();
            if (!a) a = item.select("a[href*='/html/']").first();
            if (!a) return;

            var href = a.attr("href") || "";
            var name = (a.text() || "").replace(/\s+/g, " ").trim();
            if (!name || name.length < 2) return;

            var cover = "";
            var img = item.select("img").first();
            if (img) cover = normalizeCover(img.attr("data-src") || img.attr("src"));

            data.push({
                name: name,
                link: normalizeUrl(href),
                host: HOST,
                cover: cover,
                description: ""
            });
        });
    }

    // Strategy 4: Generic book links
    if (data.length === 0) {
        var seen = {};
        doc.select("a[href*='/book/']").forEach(function(a) {
            var href = a.attr("href") || "";
            if (!href.match(/\/book\/\d+/)) return;
            var name = (a.text() || "").replace(/\s+/g, " ").trim();
            if (!name || name.length < 2) return;
            var fullUrl = normalizeUrl(href);
            if (seen[fullUrl]) return;
            seen[fullUrl] = true;

            data.push({
                name: name,
                link: fullUrl,
                host: HOST,
                cover: "",
                description: ""
            });
        });
    }

    return data;
}

function findNextPage(doc, currentUrl) {
    var nextHref = "";
    doc.select("a").forEach(function(a) {
        var text = (a.text() || "").replace(/\s+/g, "").trim();
        if (text === "下页" || text === "下一页" || text === "下一頁" || text === "»") {
            nextHref = a.attr("href") || "";
        }
    });

    if (!nextHref) return null;

    var match = currentUrl.match(/\/(\d+)\.html$/);
    if (match) {
        return (parseInt(match[1], 10) + 1).toString();
    }

    var ascMatch = currentUrl.match(/\/asc-(\d+)\/?$/);
    if (ascMatch) {
        return (parseInt(ascMatch[1], 10) + 1).toString();
    }

    return null;
}

function execute(url, page) {
    var targetUrl = url;
    if (page) {
        if (targetUrl.match(/\/\d+\.html$/)) {
            targetUrl = targetUrl.replace(/\/\d+\.html$/, "/" + page + ".html");
        } else if (targetUrl.match(/\/asc-\d+\/?$/)) {
            targetUrl = targetUrl.replace(/\/asc-\d+\/?$/, "/asc-" + page + "/");
        }
    }

    var doc = loadDoc(targetUrl, HOST + "/");
    if (!doc) return null;

    var data = parseArticles(doc);
    var next = findNextPage(doc, targetUrl);

    return Response.success(data, next);
}
