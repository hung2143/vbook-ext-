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

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);

    var baseChapPathMatch = url.match(/(\/book\/\d+\/\d+)/);
    if (!baseChapPathMatch) return null;
    var baseChapPath = baseChapPathMatch[1];

    Console.log("chap: fetching url=" + url);

    var fullContent = "";
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 20000);

        if (doc) {
            var bodyText = doc.text() || "";
            Console.log("chap: browser got " + bodyText.length + " chars");
            if (bodyText.indexOf("访问太频繁") !== -1) {
                Console.log("chap: detected rate limit, waiting 30s...");
                sleep(30000);
                doc = browser.launch(url, 20000);
            }
        }

        if (doc) {
            var contentEl = doc.select(".readcotent, #content, div.content, .chapter-content, .read-content, [class*='content'], article, main, .chapter, .read, .book-content, .article-content, #chapter-content, .xs_content");
            if (contentEl.first()) {
                fullContent = contentEl.html() || "";
            }

            if (!fullContent || fullContent.length < 50) {
                fullContent = doc.body().html() || "";
            }

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
            Console.log("chap: found nextLink=" + nextLink);

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
                    Console.log("chap: next page error: " + e);
                    break;
                }

                if (!nextDoc) break;

                var nextEl = nextDoc.select(".readcotent, #content, div.content, .chapter-content, .read-content, [class*='content'], article, main, .chapter, .read, .book-content, .article-content, #chapter-content, .xs_content");
                if (nextEl.first()) {
                    var nextHtml = nextEl.html() || "";
                    if (nextHtml.length > 50) {
                        fullContent += nextHtml;
                    }
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
            Console.log("chap: fetched " + pageCount + " extra pages, total content length=" + fullContent.length);
        }

        browser.close();
    } catch (e) {
        Console.log("chap browser error: " + e);
        try { browser.close(); } catch(e2) {}
    }

    if (!fullContent || fullContent.length < 50) {
        Console.log("chap: browser content too short, trying fetchWithRetry...");
        var doc2 = fetchWithRetry(url);
        if (doc2) {
            var contentEl2 = doc2.select(".readcotent, #content, div.content, .chapter-content, .read-content, [class*='content'], article, main, .chapter, .read, .book-content, .article-content, #chapter-content, .xs_content");
            if (contentEl2.first()) {
                fullContent = contentEl2.html() || "";
            }
            if (!fullContent || fullContent.length < 50) {
                fullContent = doc2.body().html() || "";
            }
            Console.log("chap: fetchWithRetry got " + fullContent.length + " chars");
        }
    }

    if (fullContent && fullContent.length > 50) {
        fullContent = fullContent.replace(/sto55\.com/g, "");
        fullContent = fullContent.replace(/思兔阅读/g, "");
        fullContent = fullContent.replace(/思兔閱讀/g, "");
        Console.log("chap: final content length=" + fullContent.length);
        return Response.success(fullContent);
    }

    return Response.error("无法获取章节内容，请稍后重试。");
}
