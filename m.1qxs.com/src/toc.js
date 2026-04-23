var HOST = "https://m.1qxs.com";
var MAX_RETRIES = 3;
var RETRY_DELAY = 5000;

function fetchWithRetry(url, referer) {
    for (var i = 0; i < MAX_RETRIES; i++) {
        try {
            var response = fetch(url, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": referer || HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (response.ok) {
                var doc = response.html();
                var bodyText = doc.text() || "";
                // Check for rate limit
                if (bodyText.indexOf("访问太频繁") !== -1) {
                    Console.log("Rate limited, waiting 30s...");
                    sleep(30000);
                    continue;
                }
                return doc;
            }
            if (response.status === 403 || response.status === 429) {
                Console.log("Blocked (" + response.status + "), waiting...");
                sleep(RETRY_DELAY * (i + 1));
                continue;
            }
        } catch (e) {
            Console.log("Fetch error attempt " + (i + 1) + ": " + e);
            sleep(RETRY_DELAY);
        }
    }
    return null;
}

function browserFetch(url) {
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
        return doc;
    } catch (e) {
        Console.log("Browser error: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function execute(url) {
    // Normalize URL
    url = url.replace(/https?:\/\/(www\.)?1qxs\.com/, HOST);

    // Extract book ID
    var bookIdMatch = url.match(/\/xs_1\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    // Catalog URL - the dedicated chapter list page
    var catalogUrl = HOST + "/catalog_1/" + bookId;
    var detailUrl = HOST + "/xs_1/" + bookId + "/";

    // Strategy 1: Use browser to load catalog page (most reliable for anti-bot)
    var doc = browserFetch(catalogUrl);

    // Strategy 2: Fallback to fetch with proper headers
    if (!doc) {
        doc = fetchWithRetry(catalogUrl, detailUrl);
    }

    if (!doc) {
        // Strategy 3: Try loading from detail page and extracting chapter links
        doc = browserFetch(detailUrl);
        if (!doc) {
            doc = fetchWithRetry(detailUrl, HOST + "/");
        }
    }

    if (!doc) return null;

    var data = [];
    var currentUrl = doc.select("link[rel='canonical']").attr("href") || catalogUrl;
    var isCatalogPage = currentUrl.indexOf("catalog_1") !== -1;

    if (isCatalogPage) {
        // Parse chapters from catalog page
        // Chapters are in <a> tags with href containing /xs_1/{bookId}/
        var chapterLinks = doc.select("a[href*='/xs_1/" + bookId + "/']");
        chapterLinks.forEach(function(e) {
            var href = e.attr("href");
            // Skip non-chapter links (like back-to-detail links)
            if (!href || href === "/xs_1/" + bookId + "/" || href === detailUrl) return;
            // Must have a number after the book ID (chapter ID)
            if (!href.match(/\/xs_1\/\d+\/\d+/)) return;

            var name = e.text().trim();
            // Remove leading numbers/spaces from span elements
            var spanEl = e.select("span");
            if (spanEl.first()) {
                var spanText = spanEl.text();
                name = name.replace(spanText, "").trim();
                if (!name) name = spanText.trim();
            }
            if (!name) name = e.select("p").text().trim();
            if (!name) return;

            data.push({
                name: name,
                url: href,
                host: HOST
            });
        });

        // Handle pagination in catalog (select.pagelist with range options)
        var pageSelect = doc.select("select.pagelist, select[name='pagelist']");
        if (pageSelect.first()) {
            var options = pageSelect.select("option");
            var currentPage = -1;
            options.forEach(function(opt) {
                if (opt.attr("selected") !== null && opt.attr("selected") !== undefined) {
                    currentPage = options.indexOf(opt);
                }
            });

            // Load remaining pages
            for (var i = 0; i < options.size(); i++) {
                if (i === currentPage || i === 0) continue; // Skip current/first page
                var pageUrl = options.get(i).attr("value");
                if (!pageUrl) continue;
                if (!pageUrl.startsWith("http")) {
                    pageUrl = HOST + pageUrl;
                }

                sleep(2000); // Delay between pages to avoid rate limit
                var pageDoc = fetchWithRetry(pageUrl, catalogUrl);
                if (!pageDoc) {
                    pageDoc = browserFetch(pageUrl);
                }
                if (!pageDoc) continue;

                pageDoc.select("a[href*='/xs_1/" + bookId + "/']").forEach(function(e) {
                    var href = e.attr("href");
                    if (!href || href === "/xs_1/" + bookId + "/" || href === detailUrl) return;
                    if (!href.match(/\/xs_1\/\d+\/\d+/)) return;

                    var name = e.text().trim();
                    var spanEl = e.select("span");
                    if (spanEl.first()) {
                        var spanText = spanEl.text();
                        name = name.replace(spanText, "").trim();
                        if (!name) name = spanText.trim();
                    }
                    if (!name) name = e.select("p").text().trim();
                    if (!name) return;

                    data.push({
                        name: name,
                        url: href,
                        host: HOST
                    });
                });
            }
        }
    } else {
        // On detail page - find chapter links
        // Look for all chapter <a> tags in the latest chapters section
        doc.select("a[href*='/xs_1/" + bookId + "/']").forEach(function(e) {
            var href = e.attr("href");
            if (!href || href === "/xs_1/" + bookId + "/" || href === detailUrl) return;
            if (!href.match(/\/xs_1\/\d+\/\d+/)) return;

            var name = e.text().trim();
            if (!name) return;

            data.push({
                name: name,
                url: href,
                host: HOST
            });
        });

        // Also try to go to catalog page for full list
        if (data.length < 50) {
            sleep(2000);
            var catDoc = fetchWithRetry(catalogUrl, detailUrl);
            if (!catDoc) catDoc = browserFetch(catalogUrl);
            if (catDoc) {
                data = []; // Reset - prefer catalog data
                catDoc.select("a[href*='/xs_1/" + bookId + "/']").forEach(function(e) {
                    var href = e.attr("href");
                    if (!href || href === "/xs_1/" + bookId + "/" || href === detailUrl) return;
                    if (!href.match(/\/xs_1\/\d+\/\d+/)) return;

                    var name = e.text().trim();
                    var spanEl = e.select("span");
                    if (spanEl.first()) {
                        var spanText = spanEl.text();
                        name = name.replace(spanText, "").trim();
                        if (!name) name = spanText.trim();
                    }
                    if (!name) name = e.select("p").text().trim();
                    if (!name) return;

                    data.push({
                        name: name,
                        url: href,
                        host: HOST
                    });
                });
            }
        }
    }

    if (data.length > 0) {
        return Response.success(data);
    }
    return null;
}