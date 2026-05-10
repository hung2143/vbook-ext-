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

    var doc = browserFetch(catalogUrl);
    if (!doc) {
        doc = fetchWithRetry(catalogUrl);
    }

    if (!doc) {
        Console.log("toc: cannot fetch page, url=" + catalogUrl);
        return Response.success([]);
    }

    var bodyText = doc.text() || "";
    Console.log("toc: fetched " + bodyText.length + " chars, url=" + catalogUrl);
    Console.log("toc: page preview (first 500): " + bodyText.substring(0, 500));

    var data = [];
    var seen = {};

    // Try main selector: a[href*='/book/{bookId}/']
    var links = doc.select("a[href*='/book/" + bookId + "/']");
    Console.log("toc: found " + links.size() + " links matching /book/" + bookId + "/");
    links.forEach(function(e) {
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

    // Fallback: any link containing bookId in path
    if (data.length === 0) {
        Console.log("toc: first selector failed, trying fallback selectors...");
        var fallbackSelectors = [
            "a[href*='/book/']",
            ".chapter-list a",
            ".catalog a",
            "#chapter-list a",
            ".list a",
            "[class*='chapter'] a",
            "[class*='catalog'] a",
            "[id*='chapter'] a",
            "[id*='catalog'] a"
        ];
        for (var fi = 0; fi < fallbackSelectors.length; fi++) {
            var sel = fallbackSelectors[fi];
            var els = doc.select(sel);
            Console.log("toc: fallback selector '" + sel + "' found " + els.size() + " elements");
            els.forEach(function(e) {
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
            if (data.length > 0) break;
        }
    }

    // Fallback: try to find chapter URLs via regex in page text
    if (data.length === 0) {
        Console.log("toc: fallback selectors failed, trying regex extraction...");
        var regexMatches = bodyText.match(/\/book\/\d+\/\d+/g);
        if (regexMatches) {
            Console.log("toc: regex found " + regexMatches.length + " chapter URLs");
            for (var ri = 0; ri < regexMatches.length; ri++) {
                var m = regexMatches[ri];
                var match2 = m.match(/\/book\/(\d+)\/(\d+)/);
                if (!match2) continue;
                if (parseInt(match2[1]) !== parseInt(bookId)) continue;

                var chapUrl = HOST + m;
                if (seen[chapUrl]) continue;
                seen[chapUrl] = true;

                // Try to find a name near this URL
                var idx = bodyText.indexOf(m);
                var name = "";
                if (idx !== -1) {
                    var snippet = bodyText.substring(Math.max(0, idx - 50), idx + m.length + 50);
                    var nameMatch = snippet.match(/>([^<]{1,50})</);
                    if (nameMatch) name = nameMatch[1].trim();
                }
                if (!name) name = "第" + match2[2] + "章";

                data.push({
                    name: name,
                    url: chapUrl,
                    host: HOST
                });
            }
        }
    }

    Console.log("toc: total chapters found: " + data.length);
    if (data.length > 0) {
        return Response.success(data);
    }

    Console.log("toc: all selectors failed, returning empty list");
    return Response.success([]);
}
