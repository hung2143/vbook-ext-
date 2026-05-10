var HOST = "https://sto55.com";

function browserFetch(url, timeout) {
    if (!timeout) timeout = 20000;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, timeout);
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

function execute(key, page) {
    var pageNum = parseInt(page || "1", 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var searchUrl = HOST + "/search/?searchkey=" + encodeURIComponent(key) + "&page=" + pageNum;

    var doc = browserFetch(searchUrl);
    if (!doc) {
        var response = fetch(searchUrl, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/",
                "accept-language": "zh-CN,zh;q=0.9"
            }
        });
        if (response && response.ok) {
            doc = response.html();
        }
    }

    if (!doc) return Response.success([], null);

    var data = [];
    var seen = {};

    doc.select("a[href*='/book/']").forEach(function(e) {
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

    var next = null;
    var pageMatch = searchUrl.match(/page=(\d+)/);
    if (pageMatch) {
        var currentPage = parseInt(pageMatch[1]);
        var hasNext = false;
        doc.select("a").forEach(function(a) {
            var text = a.text();
            if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1 || text.indexOf("»") !== -1) {
                hasNext = true;
            }
        });
        if (hasNext) {
            next = String(currentPage + 1);
        }
    }

    return Response.success(data, next);
}
