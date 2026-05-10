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
            var html = node.html() || "";
            var text = node.text() || "";
            Console.log("extractContent: selector '" + selectors[i] + "' matched, text length=" + text.length);
            if (text.length > 100) {
                content = html;
                break;
            }
        }
    }

    if (!content) {
        var bodyHtml = doc.body().html() || "";
        var bodyText = doc.body().text() || "";
        var startMarkers = ["content", "chapter", "read", "正文", "readcotent"];
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
        Console.log("extractContent: no content found, using full body");
        content = doc.body().html() || "";
    }

    var originalLen = content.length;

    content = content.replace(/<script[\s\S]*?<\/script>/gi, "");
    content = content.replace(/<style[\s\S]*?<\/style>/gi, "");
    content = content.replace(/<form[\s\S]*?<\/form>/gi, "");

    content = content.replace(/<div[^>]*class="[^"]*ad[^\/]*"[\s\S]*?<\/div>/gi, "\n");
    content = content.replace(/<div[^>]*id="[^"]*ad[^\/]*"[\s\S]*?<\/div>/gi, "\n");
    content = content.replace(/<a[^>]*>[\s]*<img[^>]*>[\s]*<\/a>/gi, "");
    content = content.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
    content = content.replace(/<img[^>]*>/gi, "");

    var googleAdPatterns = [
        /<ins[\s\S]*?class="adsbygoogle"[\s\S]*?<\/ins>/gi,
        /<div[^>]*class="[^"]*google[^-][^"]*"[\s\S]*?<\/div>/gi,
        /<div[^>]*id="aswift_\d+"[\s\S]*?<\/div>/gi
    ];
    for (var gi = 0; gi < googleAdPatterns.length; gi++) {
        content = content.replace(googleAdPatterns[gi], "\n");
    }

    content = content.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");

    content = content
        .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n");

    content = content
        .replace(/<p[^>]*>/gi, "")
        .replace(/<\/p>/gi, "\n")
        .replace(/<div[^>]*>/gi, "")
        .replace(/<\/div>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/table>/gi, "\n")
        .replace(/<[^>]+>/g, "");

    content = content
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–")
        .replace(/&hellip;/g, "…")
        .replace(/&middot;/g, "·");

    content = content
        .replace(/\u3000{2,}/g, "\n\n")
        .replace(/\u3000/g, "　")
        .replace(/　{2,}/g, "　")
        .replace(/sto55\.com/g, "")
        .replace(/思兔阅读/g, "")
        .replace(/思兔閱讀/g, "");

    var footerPatterns = [
        /Copyright ©[\s\S]*?sto55\.com/,
        /温馨提示[：:]?[^\n]*/,
        /按 ?回车[^\n]*/,
        /按 ?←[^\n]*/,
        /按 ?→[^\n]*/,
        /按 ?鍵[^\n]*/,
        /返回書目[^\n]*/,
        /返回上一頁[^\n]*/,
        /進入下一頁[^\n]*/,
        /加入書籤[^\n]*/,
        /TOP↑/g,
        /上一章[^\n]*/,
        /下一章[^\n]*/,
        /章節目錄[^\n]*/,
        /關燈[^\n]*/,
        /字體[+-][^\n]*/,
        /目錄[^\n]*/,
        /書籤[^\n]*/,
        /報錯[^\n]*/,
        /^[\s　]*$/gm
    ];
    for (var fi = 0; fi < footerPatterns.length; fi++) {
        content = content.replace(footerPatterns[fi], "");
    }

    content = content.replace(/[ \t]+\n/g, "\n");
    content = content.replace(/[ \t]{2,}/g, " ");
    content = content.replace(/\n{4,}/g, "\n\n\n");
    content = content.replace(/^\n+|\n+$/g, "");
    content = content.trim();

    Console.log("extractContent: content length " + originalLen + " -> " + content.length + " after cleanup");

    return content;
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
