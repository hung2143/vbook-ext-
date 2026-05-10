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
    var text = "";

    var selectors = [
        ".readcotent",
        "#content",
        "div.content",
        ".chapter-content",
        ".read-content",
        "[class*='content']",
        "article",
        "main",
        ".chapter",
        ".read",
        ".book-content",
        ".article-content",
        "#chapter-content",
        ".xs_content"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var node = doc.select(selectors[i]).first();
        if (node) {
            var rawText = node.text() || "";
            var html = node.html() || "";
            Console.log("extractContent: selector '" + selectors[i] + "' matched, text length=" + rawText.length);
            if (rawText.length > 100) {
                text = rawText;
                break;
            }
        }
    }

    if (!text) {
        Console.log("extractContent: no content found, using full body");
        text = doc.body().text() || "";
    }

    var originalLen = text.length;

    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, "/")
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–")
        .replace(/&hellip;/g, "…")
        .replace(/&middot;/g, "·")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&lsquo;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&copy;/g, "(c)")
        .replace(/&reg;/g, "(R)")
        .replace(/&trade;/g, "(TM)")
        .replace(/&#[0-9]+;/g, "")
        .replace(/&#x[0-9a-fA-F]+;/g, "");

    text = text
        .replace(/\u3000{2,}/g, "\n\n")
        .replace(/\u3000/g, "　")
        .replace(/　{2,}/g, "　")
        .replace(/sto55\.com/g, "")
        .replace(/思兔阅读/g, "")
        .replace(/思兔閱讀/g, "")
        .replace(/Copyright ©[\s\S]*$/gm, "");

    var noisePatterns = [
        /温馨提示[：:]?[^\n]*/,
        /按[回車Enter\r\n ]*鍵?[^\n]*/gi,
        /返回書目[^\n]*/,
        /返回上一頁[^\n]*/,
        /進入下一頁[^\n]*/,
        /加入書籤[^\n]*/,
        /TOP↑/g,
        /上一章[^\n]*/,
        /下一章[^\n]*/,
        /章節目錄[^\n]*/,
        /目錄[^\n]*/,
        /書籤[^\n]*/,
        /報錯[^\n]*/,
        /關燈[^\n]*/,
        /字體[+-][^\n]*/,
        /ADVERTISEMENT/gi,
        /深入瞭解[^\n]*/,
        /圖書與文學[^\n]*/,
        /^[解書籍本\n\r]+$/gm
    ];
    for (var ni = 0; ni < noisePatterns.length; ni++) {
        text = text.replace(noisePatterns[ni], "");
    }

    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/[ \t]{2,}/g, " ");
    text = text.replace(/\n{4,}/g, "\n\n\n");
    text = text.replace(/^\n+|\n+$/g, "");
    text = text.trim();

    Console.log("extractContent: content length " + originalLen + " -> " + text.length + " after cleanup");

    return text;
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
            Console.log("chap: page preview (first 300): " + bodyText.substring(0, 300));
            if (bodyText.indexOf("访问太频繁") !== -1) {
                Console.log("chap: detected rate limit, waiting 30s...");
                sleep(30000);
                doc = browser.launch(url, 20000);
                if (doc) {
                    bodyText = doc.text() || "";
                    Console.log("chap: after wait got " + bodyText.length + " chars");
                }
            }
        } else {
            Console.log("chap: browser returned null doc");
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
            Console.log("chap: fetched " + pageCount + " extra pages, total content length=" + fullContent.length);
        }

        browser.close();
    } catch (e) {
        Console.log("chap browser error: " + e);
        try { browser.close(); } catch(e2) {}
    }

    if (!fullContent || fullContent.length < 100) {
        Console.log("chap: browser content too short, trying fetchWithRetry...");
        var doc2 = fetchWithRetry(url);
        if (doc2) {
            fullContent = extractContent(doc2);
            Console.log("chap: fetchWithRetry got " + fullContent.length + " chars");
        }
    }

    Console.log("chap: final content length=" + (fullContent ? fullContent.length : 0));

    if (fullContent && fullContent.length > 100) {
        return Response.success(fullContent);
    }

    return Response.error("无法获取章节内容，请稍后重试。");
}
