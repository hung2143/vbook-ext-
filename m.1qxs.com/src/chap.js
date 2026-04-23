var HOST = "https://m.1qxs.com";

function execute(url) {
    // Normalize URL
    url = url.replace(/https?:\/\/(www\.)?1qxs\.com/, HOST);

    // Ensure full URL
    if (!url.startsWith("http")) {
        url = HOST + url;
    }

    // Extract base chapter URL (without page number suffix like /2, /3)
    var baseUrlMatch = url.match(/(\/xs_1\/\d+\/\d+)/);
    if (!baseUrlMatch) return null;
    var baseChapPath = baseUrlMatch[1];

    // Strategy 1: Use browser (most reliable)
    var fullContent = "";
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 15000);

        if (doc) {
            var bodyText = doc.text() || "";
            // Rate limit check
            if (bodyText.indexOf("访问太频繁") !== -1) {
                sleep(30000);
                doc = browser.launch(url, 15000);
            }
        }

        if (doc) {
            // Get content from first page
            var contentEl = doc.select("div.content, #content, .chapter-content, .read-content");
            if (contentEl.first()) {
                fullContent = contentEl.html();
            }

            // Check for multi-page chapter (pagination: 1/4, 2/4, etc.)
            // Look for "下一页" (next page) link
            var nextLink = null;
            doc.select("a").forEach(function(a) {
                var text = a.text();
                if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1) {
                    var href = a.attr("href");
                    // Make sure it's a sub-page of the same chapter, not next chapter
                    if (href && href.indexOf(baseChapPath) !== -1) {
                        nextLink = href;
                    }
                }
            });

            // Load remaining pages of the same chapter
            var pageCount = 0;
            var maxPages = 20; // Safety limit
            while (nextLink && pageCount < maxPages) {
                pageCount++;
                var nextUrl = nextLink;
                if (!nextUrl.startsWith("http")) {
                    nextUrl = HOST + nextUrl;
                }

                sleep(1500); // Delay between pages
                var nextDoc = null;
                try {
                    nextDoc = browser.launch(nextUrl, 15000);
                } catch(e) {
                    break;
                }

                if (!nextDoc) break;

                var nextContent = nextDoc.select("div.content, #content, .chapter-content, .read-content");
                if (nextContent.first()) {
                    fullContent += nextContent.html();
                }

                // Check for next page again
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

    // Strategy 2: Fallback to fetch if browser failed
    if (!fullContent) {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/xs_1/",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
            }
        });
        if (response.ok) {
            var doc2 = response.html();
            var bodyText2 = doc2.text() || "";
            if (bodyText2.indexOf("访问太频繁") !== -1) {
                sleep(30000);
                response = fetch(url, {
                    headers: {
                        "user-agent": UserAgent.android(),
                        "referer": HOST + "/xs_1/",
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                    }
                });
                if (response.ok) doc2 = response.html();
            }

            var contentEl2 = doc2.select("div.content, #content, .chapter-content, .read-content");
            if (contentEl2.first()) {
                fullContent = contentEl2.html();
            }

            // Handle pagination with fetch
            var nextLink2 = null;
            doc2.select("a").forEach(function(a) {
                var text = a.text();
                if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1) {
                    var href = a.attr("href");
                    if (href && href.indexOf(baseChapPath) !== -1) {
                        nextLink2 = href;
                    }
                }
            });

            var pc = 0;
            while (nextLink2 && pc < 20) {
                pc++;
                var nUrl = nextLink2;
                if (!nUrl.startsWith("http")) nUrl = HOST + nUrl;

                sleep(1500);
                var nResp = fetch(nUrl, {
                    headers: {
                        "user-agent": UserAgent.android(),
                        "referer": url,
                        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                    }
                });
                if (!nResp.ok) break;

                var nDoc = nResp.html();
                var nContent = nDoc.select("div.content, #content, .chapter-content, .read-content");
                if (nContent.first()) {
                    fullContent += nContent.html();
                }

                nextLink2 = null;
                nDoc.select("a").forEach(function(a) {
                    var text = a.text();
                    if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1) {
                        var href = a.attr("href");
                        if (href && href.indexOf(baseChapPath) !== -1) {
                            nextLink2 = href;
                        }
                    }
                });
            }
        }
    }

    if (fullContent) {
        // Clean up content
        fullContent = fullContent.replace(/1qxs\.com/gi, "");
        fullContent = fullContent.replace(/一七小说/gi, "");
        fullContent = fullContent.replace(/\u0026nbsp;/g, "");
        return Response.success(fullContent);
    }

    return null;
}