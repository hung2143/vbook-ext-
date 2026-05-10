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

function execute(url, page) {
    var pageNum = parseInt(page || "1", 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var targetUrl = url;
    if (pageNum > 1) {
        targetUrl = url.replace(/_(\d+)\.html$/, "_" + pageNum + ".html");
        if (targetUrl === url) {
            targetUrl = url.replace(/\.html$/, "_" + pageNum + ".html");
        }
    }

    var doc = browserFetch(targetUrl);
    if (!doc) {
        doc = fetchWithRetry(targetUrl);
    }

    if (!doc) return Response.success([], null);

    var data = [];
    var seen = {};

    var bookLinks = doc.select("a[href*='/book/']");
    bookLinks.forEach(function(e) {
        var href = e.attr("href") || "";
        if (!href.match(/\/book\/\d+/)) return;

        var link = href;
        if (!link.startsWith("http")) {
            link = HOST + link;
        }

        if (seen[link]) return;
        seen[link] = true;

        var name = "";
        var nameEl = e.select("h3, h4, .name, .title").first();
        if (nameEl) {
            name = nameEl.text().trim();
        }
        if (!name) {
            var parent = e.parent();
            if (parent) {
                nameEl = parent.select("h3, h4, .name, .title").first();
                if (nameEl) name = nameEl.text().trim();
            }
        }
        if (!name) {
            name = e.text().trim();
        }
        if (!name || name.length < 2) return;

        var cover = "";
        var img = e.select("img").first();
        if (img) {
            cover = img.attr("data-src") || img.attr("src") || "";
            if (cover.startsWith("//")) cover = "https:" + cover;
            if (cover && !cover.startsWith("http")) cover = HOST + cover;
        }

        var desc = "";
        var descEl = e.select(".desc, .intro, p").first();
        if (descEl) {
            desc = descEl.text().trim();
        }

        data.push({
            name: name,
            link: link,
            host: HOST,
            cover: cover,
            description: desc
        });
    });

    if (data.length === 0) {
        doc.select("a").forEach(function(e) {
            var href = e.attr("href") || "";
            if (!href.match(/\/book\/\d+/)) return;

            var link = href;
            if (!link.startsWith("http")) {
                link = HOST + link;
            }

            if (seen[link]) return;
            seen[link] = true;

            var name = e.text().trim();
            if (!name || name.length < 2) return;
            if (/^\d+$/.test(name)) return;

            data.push({
                name: name,
                link: link,
                host: HOST,
                cover: "",
                description: ""
            });
        });
    }

    var next = null;
    var pageMatch = targetUrl.match(/_(\d+)\.html$/);
    if (pageMatch) {
        var currentPage = parseInt(pageMatch[1]);
        var hasNext = false;
        doc.select("a").forEach(function(a) {
            var text = a.text();
            if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1 || text.indexOf("»") !== -1 || text.indexOf("下一页") !== -1) {
                hasNext = true;
            }
        });
        if (hasNext) {
            next = String(currentPage + 1);
        }
    }

    return Response.success(data, next);
}
