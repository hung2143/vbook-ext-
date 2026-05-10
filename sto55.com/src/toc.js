var HOST = "https://sto55.com";

function browserFetch(url, timeout) {
    if (!timeout) timeout = 20000;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, timeout);
        if (doc) {
            var bodyText = doc.text() || "";
            if (bodyText.indexOf("访问太频繁") !== -1) {
                sleep(30000);
                doc = browser.launch(url, timeout);
            }
        }
        return doc;
    } catch (e) {
        Console.log("Browser error: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function fetchWithRetry(url) {
    for (var i = 0; i < 3; i++) {
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
                var doc = response.html();
                var bodyText = doc.text() || "";
                if (bodyText.indexOf("访问太频繁") !== -1) {
                    sleep(30000);
                    continue;
                }
                return doc;
            }
        } catch (e) {
            Console.log("Fetch error: " + e);
            sleep(3000);
        }
    }
    return null;
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);
    if (!url.endsWith("/")) url = url + "/";

    var bookIdMatch = url.match(/\/book\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    var catalogUrl = HOST + "/book/" + bookId + "/";
    var detailUrl = catalogUrl;

    var doc = browserFetch(catalogUrl);
    if (!doc) {
        doc = fetchWithRetry(catalogUrl);
    }

    if (!doc) return Response.success([]);

    var data = [];
    var seen = {};

    doc.select("a[href*='/book/" + bookId + "/']").forEach(function(e) {
        var href = e.attr("href") || "";
        if (!href.match(/\/book\/\d+\/\d+/)) return;

        var chapUrl = href;
        if (!chapUrl.startsWith("http")) {
            chapUrl = HOST + chapUrl;
        }

        if (seen[chapUrl]) return;
        seen[chapUrl] = true;

        var name = e.text().trim();
        if (!name) return;

        data.push({
            name: name,
            url: chapUrl,
            host: HOST
        });
    });

    if (data.length === 0) {
        doc.select("a[href*='/book/']").forEach(function(e) {
            var href = e.attr("href") || "";
            var match = href.match(/\/book\/(\d+)\/(\d+)/);
            if (!match) return;
            if (parseInt(match[1]) !== parseInt(bookId)) return;

            var chapUrl = href;
            if (!chapUrl.startsWith("http")) {
                chapUrl = HOST + chapUrl;
            }

            if (seen[chapUrl]) return;
            seen[chapUrl] = true;

            var name = e.text().trim();
            if (!name) return;

            data.push({
                name: name,
                url: chapUrl,
                host: HOST
            });
        });
    }

    if (data.length > 0) {
        return Response.success(data);
    }

    return Response.success([]);
}
