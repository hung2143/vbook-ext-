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

/**
 * Gửi POST request tới /search với đúng form data của sto55.com
 */
function doSearchPost(key, pageNum) {
    var searchUrl = HOST + "/search";
    var body = "searchtype=all&searchkey=" + encodeURIComponent(key) + "&action=login&submit=";
    if (pageNum > 1) {
        body += "&page=" + pageNum;
    }

    try {
        var response = fetch(searchUrl, {
            method: "POST",
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: body
        });
        if (response && response.ok) {
            return { doc: response.html(), url: response.url() || searchUrl };
        }
    } catch (e) {
        Console.log("POST fetch error: " + e);
    }
    return null;
}

/**
 * Parse kết quả từ trang sách chi tiết (khi redirect 1 kết quả)
 */
function parseBookDetailPage(doc, bookUrl) {
    var name = "";
    var h1 = doc.select("h1").first();
    if (h1) name = h1.text().trim();
    if (!name) {
        var titleEl = doc.select("title").first();
        if (titleEl) {
            name = titleEl.text().replace(/\s*思兔阅读.*$/, "").replace(/\s*最新章节.*$/, "").trim();
        }
    }

    var cover = "";
    var ogImg = doc.select("meta[property='og:image']").attr("content");
    if (ogImg) {
        cover = ogImg;
        if (cover.startsWith("//")) cover = "https:" + cover;
    }

    var desc = "";
    var descEl = doc.select(".intro, #intro, [class*='intro']").first();
    if (descEl) desc = descEl.text().trim();

    var author = "";
    var authorEl = doc.select(".author, [class*='author']").first();
    if (authorEl) author = authorEl.text().replace(/作者[：:]\s*/g, "").trim();

    if (!name) return [];
    return [{
        name: name,
        link: bookUrl,
        host: HOST,
        cover: cover,
        description: desc,
        author: author
    }];
}

/**
 * Parse danh sách kết quả từ trang search
 */
function parseSearchResults(doc) {
    var data = [];
    var seen = {};

    doc.select(".bookbox").forEach(function(box) {
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

        var author = "";
        var authorEl = box.select(".author a").first();
        if (authorEl) author = authorEl.text().trim();

        var desc = "";
        var descEl = box.select(".update").first();
        if (descEl) {
            desc = descEl.text().trim();
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

    return data;
}

function execute(key, page) {
    var pageNum = parseInt(page || "1", 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    Console.log("Searching: " + key + " page " + pageNum);

    // Thử POST request trước
    var result = doSearchPost(key, pageNum);
    var doc = null;
    var finalUrl = "";

    if (result) {
        doc = result.doc;
        finalUrl = result.url;
        Console.log("POST result URL: " + finalUrl);
    }

    // Fallback: dùng browser engine (xử lý được redirect và JS)
    if (!doc) {
        Console.log("POST failed, trying browser engine...");
        var searchUrl = HOST + "/search/" + encodeURIComponent(key) + "/1.html";
        doc = browserFetch(searchUrl, 25000);
        if (doc) finalUrl = searchUrl;
    }

    if (!doc) return Response.success([], null);

    var data = [];

    // Nếu bị redirect về trang chi tiết sách (/book/xxx)
    if (finalUrl && finalUrl.match(/\/book\/\d+/)) {
        Console.log("Redirected to book page: " + finalUrl);
        data = parseBookDetailPage(doc, finalUrl);
    } else {
        // Trang kết quả search bình thường
        var boxes = doc.select(".bookbox");
        Console.log("Found .bookbox elements: " + boxes.size());
        data = parseSearchResults(doc);
    }

    Console.log("Total results: " + data.length);

    // Kiểm tra trang tiếp theo
    var next = null;
    if (data.length > 0 && !finalUrl.match(/\/book\/\d+/)) {
        var hasNext = false;
        doc.select("a").forEach(function(a) {
            var text = a.text();
            if (text.indexOf("下一页") !== -1 || text.indexOf("下一頁") !== -1 || text.indexOf(">") !== -1) {
                hasNext = true;
            }
        });
        if (hasNext) {
            next = String(pageNum + 1);
        }
    }

    return Response.success(data, next);
}
