var HOST = "https://sto55.com";

function browserFetch(url, timeout) {
    if (!timeout) timeout = 20000;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, timeout);
        if (doc) {
            var bodyText = doc.text() || "";
            if (bodyText.indexOf("访问太频繁") !== -1 || bodyText.indexOf("请稍后") !== -1) {
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
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
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

function extractContent(doc) {
    var content = "";

    var selectors = [
        "#content",
        "div.content",
        ".chapter-content",
        ".read-content",
        "[class*='content']",
        "article",
        "main"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var node = doc.select(selectors[i]).first();
        if (node) {
            var html = node.html() || "";
            var text = node.text() || "";
            if (text.length > 100) {
                content = html;
                break;
            }
        }
    }

    if (!content) {
        var bodyHtml = doc.body().html() || "";
        var bodyText = doc.body().text() || "";
        var startMarkers = ["content", "chapter", "read"];
        for (var j = 0; j < startMarkers.length; j++) {
            var idx = bodyText.indexOf(startMarkers[j]);
            if (idx !== -1 && idx < bodyText.length - 200) {
                var potentialContent = bodyHtml.substring(Math.max(0, idx - 100), idx + 50000);
                if (potentialContent.length > 200) {
                    content = potentialContent;
                    break;
                }
            }
        }
    }

    if (!content) {
        content = doc.body().html() || "";
    }

    content = content.replace(/<script[\s\S]*?<\/script>/gi, "");
    content = content.replace(/<style[\s\S]*?<\/style>/gi, "");
    content = content.replace(/<form[\s\S]*?<\/form>/gi, "");
    content = content.replace(/sto55\.com/gi, "");
    content = content.replace(/思兔阅读/gi, "");
    content = content.replace(/思兔閱讀/gi, "");
    content = content.replace(/\u00a0/g, " ");

    return content;
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);
    if (!url.endsWith("/")) url = url + "/";

    var baseChapPathMatch = url.match(/(\/book\/\d+\/\d+)/);
    if (!baseChapPathMatch) return null;
    var baseChapPath = baseChapPathMatch[1];

    var fullContent = "";
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 20000);

        if (doc) {
            var bodyText = doc.text() || "";
            if (bodyText.indexOf("访问太频繁") !== -1) {
                sleep(30000);
                doc = browser.launch(url, 20000);
            }
        }

        if (doc) {
            fullContent = extractContent(doc);

            var nextLink = null;
            doc.select("a").forEach(function(a) {
                var text = a.text();
                if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1) {
                    var href = a.attr("href");
                    if (href && href.indexOf(baseChapPath) !== -1) {
                        nextLink = href;
                    }
                }
            });

            var pageCount = 0;
            var maxPages = 20;
            while (nextLink && pageCount < maxPages) {
                pageCount++;
                var nextUrl = nextLink;
                if (!nextUrl.startsWith("http")) {
                    nextUrl = HOST + nextUrl;
                }

                sleep(2000);
                var nextDoc = null;
                try {
                    nextDoc = browser.launch(nextUrl, 20000);
                } catch(e) {
                    break;
                }

                if (!nextDoc) break;

                var nextHtml = extractContent(nextDoc);
                if (nextHtml.length > 50) {
                    fullContent += "\n" + nextHtml;
                }

                nextLink = null;
                nextDoc.select("a").forEach(function(a) {
                    var text = a.text();
                    if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1) {
                        var href = a.attr("href");
                        if (href && href.indexOf(baseChapPath) !== -1) {
                            nextLink = href;
                        }
                    }
                });
            }
        }

        browser.close();
    } catch (e) {
        Console.log("chap browser error: " + e);
        try { browser.close(); } catch(e2) {}
    }

    if (!fullContent || fullContent.length < 100) {
        var doc2 = fetchWithRetry(url);
        if (doc2) {
            fullContent = extractContent(doc2);
        }
    }

    if (fullContent && fullContent.length > 100) {
        return Response.success(fullContent);
    }

    return Response.error("无法获取章节内容，请稍后重试。");
}
