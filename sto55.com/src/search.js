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

    // Dùng format URL đúng: /search/{key}/{page}.html
    var searchUrl = HOST + "/search/" + encodeURIComponent(key) + "/" + pageNum + ".html";

    var doc = fetchWithRetry(searchUrl);
    if (!doc) {
        doc = browserFetch(searchUrl);
    }

    if (!doc) return Response.success([], null);

    var data = [];
    var seen = {};

    // Mỗi kết quả nằm trong .bookbox
    doc.select(".bookbox").forEach(function(box) {
        // Lấy link và tên từ .bookname a
        var nameEl = box.select(".bookname a").first();
        if (!nameEl) return;

        var href = nameEl.attr("href") || "";
        if (!href.match(/\/book\/\d+/)) return;

        var link = href;
        if (!link.startsWith("http")) {
            link = HOST + link;
        }

        if (seen[link]) return;
        seen[link] = true;

        var name = nameEl.text().trim();
        if (!name || name.length < 2) return;

        // Lấy tác giả
        var author = "";
        var authorEl = box.select(".author a.del_but").first();
        if (authorEl) {
            author = authorEl.text().trim();
        }

        // Lấy mô tả từ .update (bỏ tiền tố "簡介：")
        var desc = "";
        var descEl = box.select(".update").first();
        if (descEl) {
            desc = descEl.text().trim();
            // Bỏ tiền tố "簡介：" hoặc "简介："
            desc = desc.replace(/^簡介[：:]\s*/, "").replace(/^简介[：:]\s*/, "").trim();
        }

        data.push({
            name: name,
            link: link,
            host: HOST,
            cover: "",
            description: desc,
            author: author
        });
    });

    // Kiểm tra trang tiếp theo
    var next = null;
    var hasNext = false;
    doc.select("a").forEach(function(a) {
        var text = a.text();
        if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1 || text.indexOf("»") !== -1) {
            hasNext = true;
        }
    });
    if (hasNext) {
        next = String(pageNum + 1);
    }

    return Response.success(data, next);
}
