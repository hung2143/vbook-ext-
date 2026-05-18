var HOST = "https://sto55.com";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    return HOST + (link.indexOf("/") === 0 ? link : "/" + link);
}

// Sinh URL ảnh từ book ID theo quy luật của sto55.com
function buildCoverUrl(bookId) {
    var id = parseInt(bookId, 10);
    if (isNaN(id)) return "";
    var folder = Math.floor(id / 1000);
    return HOST + "/files/article/image/" + folder + "/" + id + "/" + id + "s.jpg";
}

function fetchDoc(url) {
    for (var i = 0; i < 2; i++) {
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
                if (bodyText.length > 500) return doc;
            }
        } catch (e) {
            Console.log("fetch error: " + e);
            sleep(2000);
        }
    }

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
        Console.log("browser error: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function parseBooks(doc) {
    var data = [];
    var seen = {};

    // === Strategy 1: .bookbox (cấu trúc trang ranking/latest của sto55.com) ===
    var boxes = doc.select(".bookbox");
    Console.log("latest: .bookbox count=" + boxes.size());

    if (boxes.size() > 0) {
        boxes.forEach(function(box) {
            // Chỉ lấy tên truyện từ .bookname a hoặc h4 a
            // KHÔNG lấy từ .cat a (đó là tên chương mới nhất)
            var nameLink = box.select(".bookname a, h4 a").first();
            if (!nameLink) return;

            var href = nameLink.attr("href") || "";
            var bookIdMatch = href.match(/\/book\/(\d+)/);
            if (!bookIdMatch) return;

            var bookId = bookIdMatch[1];
            var link = normalizeUrl(href);

            if (seen[link]) return;
            seen[link] = true;

            var name = nameLink.text().trim();
            if (!name || name.length < 2) return;

            // Ảnh bìa: sinh từ ID
            var cover = buildCoverUrl(bookId);

            // Tác giả
            var author = "";
            box.select(".author").forEach(function(el) {
                var txt = el.text().trim();
                if (txt.indexOf("作者") !== -1) {
                    author = txt.replace(/^作者[：:]\s*/, "").trim();
                }
            });

            // Mô tả
            var desc = "";
            var updateEl = box.select(".update").first();
            if (updateEl) {
                desc = updateEl.text().replace(/^簡介[：:]\s*/, "").trim();
            }

            data.push({
                name: name,
                link: link,
                host: HOST,
                cover: cover,
                description: author ? (author + (desc ? " - " + desc : "")) : desc
            });
        });

        if (data.length > 0) return data;
    }

    // === Strategy 2: li với .bookname hoặc h3/h4 ===
    var items = doc.select("li");
    Console.log("latest: li fallback count=" + items.size());
    items.forEach(function(li) {
        // Ưu tiên link chỉ có /book/ID/ (không có chapId)
        var nameLink = li.select(".bookname a, h3 a, h4 a").first();
        if (!nameLink) {
            var allLinks = li.select("a[href*='/book/']");
            allLinks.forEach(function(a) {
                if (nameLink) return;
                var h = a.attr("href") || "";
                if (h.match(/\/book\/\d+\/?$/)) nameLink = a;
            });
        }
        if (!nameLink) return;

        var href = nameLink.attr("href") || "";
        var bookIdMatch = href.match(/\/book\/(\d+)/);
        if (!bookIdMatch) return;

        var bookId = bookIdMatch[1];
        var link = normalizeUrl(href);
        if (seen[link]) return;
        seen[link] = true;

        var name = nameLink.text().trim();
        if (!name || name.length < 2) return;

        var cover = buildCoverUrl(bookId);

        data.push({
            name: name,
            link: link,
            host: HOST,
            cover: cover,
            description: ""
        });
    });

    return data;
}

function findNextPage(doc, targetUrl) {
    var hasNext = false;
    doc.select("a").forEach(function(a) {
        var text = (a.text() || "").trim();
        if (text === "下一页" || text === "下一頁" || text === "»" || text === "下页") {
            hasNext = true;
        }
    });
    if (!hasNext) return null;

    var m = targetUrl.match(/_(\d+)\.html$/);
    if (m) {
        return String(parseInt(m[1], 10) + 1);
    }
    return null;
}

function execute(url, page) {
    var pageNum = parseInt(page || "1", 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var targetUrl = url;
    if (pageNum > 1) {
        targetUrl = url.replace(/_(\d+)\.html$/, "_" + pageNum + ".html");
    }

    Console.log("latest: fetching " + targetUrl);
    var doc = fetchDoc(targetUrl);
    if (!doc) return Response.success([], null);

    Console.log("latest: fetched " + (doc.text() || "").length + " chars");

    var data = parseBooks(doc);
    Console.log("latest: parsed " + data.length + " books");

    var next = findNextPage(doc, targetUrl);
    return Response.success(data, next);
}
