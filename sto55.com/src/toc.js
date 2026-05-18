var HOST = "https://sto55.com";

function fetchAjaxChapters(bookId) {
    // sto55.com ẩn phần lớn chương phía sau nút "LoadMore()"
    // Toàn bộ danh sách chương được trả về qua endpoint AJAX này
    var ajaxUrl = HOST + "/book/" + bookId + "/ajax_index.html";
    Console.log("toc: fetching ajax chapter list: " + ajaxUrl);

    for (var i = 0; i < 3; i++) {
        try {
            var response = fetch(ajaxUrl, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/book/" + bookId + "/",
                    "x-requested-with": "XMLHttpRequest",
                    "accept": "text/html, */*; q=0.01",
                    "accept-language": "zh-CN,zh;q=0.9"
                }
            });
            if (response && response.ok) {
                var doc = response.html();
                var bodyText = doc.text() || "";
                if (bodyText.indexOf("访问太频繁") !== -1) {
                    Console.log("toc ajax: rate limited, waiting 30s...");
                    sleep(30000);
                    continue;
                }
                Console.log("toc ajax: got " + bodyText.length + " chars");
                return doc;
            }
        } catch (e) {
            Console.log("toc ajax fetch error: " + e);
            sleep(3000);
        }
    }
    return null;
}

function fetchMainPage(bookId) {
    var catalogUrl = HOST + "/book/" + bookId + "/";
    Console.log("toc: fetching main page: " + catalogUrl);

    // Thử fetch thường trước
    for (var i = 0; i < 3; i++) {
        try {
            var response = fetch(catalogUrl, {
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
            Console.log("toc main fetch error: " + e);
            sleep(3000);
        }
    }

    // Fallback: dùng browser
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(catalogUrl, 20000);
        if (doc) {
            var bodyText = doc.text() || "";
            if (bodyText.indexOf("访问太频繁") !== -1) {
                sleep(30000);
                doc = browser.launch(catalogUrl, 20000);
            }
        }
        return doc;
    } catch (e) {
        Console.log("toc browser error: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function parseChapters(doc, bookId) {
    var data = [];
    var seen = {};

    // Selector chính: thẻ dd > a chứa link chapter
    var links = doc.select("dd a[href]");
    Console.log("toc: dd>a links found: " + links.size());

    if (links.size() === 0) {
        // Fallback: tìm link theo pattern /book/{id}/
        links = doc.select("a[href*='/book/" + bookId + "/']");
        Console.log("toc: fallback links found: " + links.size());
    }

    links.forEach(function(e) {
        var href = e.attr("href") || "";
        // Chỉ lấy URL dạng /book/{id}/{chapId}
        if (!href.match(/\/book\/\d+\/[\w]+/)) return;

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

    return data;
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);
    if (!url.endsWith("/")) url = url + "/";

    var bookIdMatch = url.match(/\/book\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    Console.log("toc: bookId=" + bookId);

    // === BƯỚC 1: Gọi AJAX endpoint để lấy TOÀN BỘ danh sách chương ===
    // Trang HTML mặc định chỉ hiển thị ~40 chương, phần còn lại ẩn sau nút LoadMore()
    // AJAX endpoint trả về HTML chứa đầy đủ tất cả chương
    var ajaxDoc = fetchAjaxChapters(bookId);
    if (ajaxDoc) {
        var data = parseChapters(ajaxDoc, bookId);
        Console.log("toc: ajax returned " + data.length + " chapters");
        if (data.length > 0) {
            return Response.success(data);
        }
    }

    // === BƯỚC 2: Fallback - tải trang chính (chỉ có ~40 chương) ===
    Console.log("toc: ajax failed, falling back to main page...");
    var mainDoc = fetchMainPage(bookId);
    if (!mainDoc) {
        Console.log("toc: cannot fetch any page");
        return Response.success([]);
    }

    var bodyText = mainDoc.text() || "";
    Console.log("toc: main page fetched " + bodyText.length + " chars");

    var data = parseChapters(mainDoc, bookId);
    Console.log("toc: main page found " + data.length + " chapters");

    if (data.length > 0) {
        return Response.success(data);
    }

    Console.log("toc: no chapters found");
    return Response.success([]);
}
