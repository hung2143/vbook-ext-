var HOST = "https://sto55.com";
var METADATA_HOST = "https://sto9.com";

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
            if (response && (response.status === 403 || response.status === 429)) {
                sleep(5000 * (i + 1));
                continue;
            }
        } catch (e) {
            Console.log("Fetch error attempt " + (i + 1) + ": " + e);
            sleep(5000);
        }
    }
    return null;
}

function cleanDescription(value) {
    return (value || "")
        .replace(/<br\s*\/?\s*>/gi, " ")
        .replace(/&(?:emsp|nbsp);/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/^\s*(?:簡介|简介)[：:]\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeBookName(value) {
    return (value || "")
        .replace(/[\s\u3000]+/g, "")
        .replace(/[：:，,。．·・!！?？“”"'‘’《》〈〉（）()【】\[\]—_\-]/g, "")
        .toLowerCase();
}

function descriptionFromSto55Search(doc, bookId) {
    var desc = "";
    doc.select(".bookbox").forEach(function(box) {
        if (desc) return;

        var linkEl = box.select(".bookname a").first();
        if (!linkEl) return;

        var href = linkEl.attr("href") || "";
        var idMatch = href.match(/\/book\/(\d+)/);
        if (!idMatch || idMatch[1] !== String(bookId)) return;

        var updateEl = box.select(".update").first();
        if (updateEl) desc = cleanDescription(updateEl.text());
    });
    return desc;
}

function buildSto55SearchKeys(bookName) {
    var keys = [];
    var name = (bookName || "").trim();

    function add(value) {
        value = (value || "").trim();
        if (value.length < 2 || value === name || keys.indexOf(value) !== -1) return;
        keys.push(value);
    }

    // Tìm đúng toàn bộ tên thường bị sto55 chuyển thẳng về trang chi tiết rỗng.
    // Một phần tên sẽ giữ trang kết quả, nơi .update chứa phần giới thiệu đầy đủ.
    var parts = name.split(/[：:，,。．·・!！?？—_\-]/);
    for (var i = 0; i < parts.length; i++) add(parts[i]);
    if (name.length > 3) add(name.substring(0, Math.min(4, name.length - 1)));
    if (name.length > 2) add(name.substring(0, 2));

    return keys;
}

function fetchDescFromSto55(bookName, bookId) {
    var keys = buildSto55SearchKeys(bookName);
    for (var i = 0; i < keys.length; i++) {
        try {
            var searchUrl = HOST + "/search/" + encodeURIComponent(keys[i]) + "/1.html";
            var response = fetch(searchUrl, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (!response || !response.ok) continue;

            var desc = descriptionFromSto55Search(response.html(), bookId);
            if (desc) return desc;
        } catch (e) {
            Console.log("sto55 description search error: " + e);
        }
    }
    return "";
}

function emptyBookMetadata() {
    return {
        name: "",
        author: "",
        category: "",
        status: "",
        wordCount: "",
        updated: "",
        description: ""
    };
}

function valueAfterLabel(value, labelPattern) {
    var match = (value || "").trim().match(labelPattern);
    return match ? match[1].trim() : "";
}

function fetchMetadataFromSto9(bookName) {
    var metadata = emptyBookMetadata();
    try {
        var searchUrl = METADATA_HOST + "/search/" + encodeURIComponent(bookName) + "/1.html";
        var response = fetch(searchUrl, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": METADATA_HOST + "/",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
            }
        });
        if (!response || !response.ok) return metadata;

        var doc = response.html();
        var resultName = doc.select("meta[property='og:title']").attr("content") ||
            doc.select(".booknav2 h1").text();
        if (normalizeBookName(resultName) !== normalizeBookName(bookName)) return metadata;

        metadata.name = resultName.trim();
        metadata.author = (doc.select("meta[property='og:novel:author']").attr("content") || "").trim();
        metadata.category = (doc.select("meta[property='og:novel:category']").attr("content") || "").trim();
        metadata.status = (doc.select("meta[property='og:novel:status']").attr("content") || "").trim();
        metadata.updated = (doc.select("meta[property='og:novel:update_time']").attr("content") || "").trim();
        var descriptionEl = doc.select("#tab_info .navtxt p").first();
        metadata.description = descriptionEl ? descriptionEl.text() : "";
        if (!metadata.description) {
            metadata.description = doc.select("meta[property='og:description']").attr("content") || "";
        }
        metadata.description = cleanDescription(metadata.description);

        // Các dòng này có định dạng giống ảnh: 作者 / 分類 / 狀態 / 字數 / 更新.
        doc.select(".booknav2 p").forEach(function(element) {
            var text = element.text().trim();
            var value = "";

            value = valueAfterLabel(text, /^(?:作者)[：:]\s*(.+)$/);
            if (value) metadata.author = value;

            value = valueAfterLabel(text, /^(?:分類|分类)[：:]\s*(.+)$/);
            if (value) metadata.category = value;

            value = valueAfterLabel(text, /^(?:狀態|状态)[：:]\s*(.+)$/);
            if (value) metadata.status = value;

            value = valueAfterLabel(text, /^(?:字數|字数)[：:]\s*(.+)$/);
            if (value) metadata.wordCount = value;

            value = valueAfterLabel(text, /^(?:更新|更新時間|更新时间)[：:]\s*(.+)$/);
            if (value) metadata.updated = value;
        });

        return metadata;
    } catch (e) {
        Console.log("sto9 metadata fallback error: " + e);
        return metadata;
    }
}

/**
 * sto9 cung cấp đủ metadata trong trang sách. Nếu mô tả ở đó tạm thiếu thì lấy
 * .bookbox .update của sto55 theo đúng bookId.
 */
function fetchBookMetadata(bookName, bookId) {
    if (!bookName) return emptyBookMetadata();

    var metadata = fetchMetadataFromSto9(bookName);
    if (!metadata.description) metadata.description = fetchDescFromSto55(bookName, bookId);

    Console.log("fetchBookMetadata result: " +
        (metadata.description ? metadata.description.substring(0, 50) + "..." : "EMPTY"));
    return metadata;
}

function escapeHtml(value) {
    return (value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildIntroduction(bookName, author, description) {
    var lines = [];
    if (author) lines.push("作者：" + escapeHtml(author));
    if (bookName) lines.push("作品：" + escapeHtml(bookName));

    var intro = lines.join("<br>");
    if (description) {
        if (intro) intro += "<br><br>";
        intro += escapeHtml(description);
    }
    return intro;
}

function buildGenres(category) {
    if (!category) return [];

    var categoryIds = {
        "玄幻奇幻": 1,
        "武俠仙俠": 2,
        "武侠仙侠": 2,
        "現代都市": 3,
        "现代都市": 3,
        "歷史軍事": 4,
        "历史军事": 4,
        "科幻小說": 5,
        "科幻小说": 5,
        "遊戲競技": 6,
        "游戏竞技": 6,
        "恐怖靈異": 7,
        "恐怖灵异": 7,
        "言情小說": 8,
        "言情小说": 8,
        "其他類型": 9,
        "其他类型": 9
    };
    var categoryId = categoryIds[category];
    var genre = { title: category };

    if (categoryId) {
        genre.input = HOST + "/shuku/0/" + categoryId + "/0/0/0/0/lastupdate/1.html";
        genre.script = "book.js";
    }
    return [genre];
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);
    if (!url.endsWith("/")) url = url + "/";

    var bookIdMatch = url.match(/\/book\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    var detailUrl = HOST + "/book/" + bookId + "/";

    var doc = browserFetch(detailUrl);
    if (!doc) {
        doc = fetchWithRetry(detailUrl);
    }

    if (!doc) return null;

    var bodyText = doc.text() || "";

    var name = "";
    var h1 = doc.select("h1").first();
    if (h1) {
        name = h1.text().trim();
    }
    if (!name) {
        var titleMeta = doc.select("meta[property='og:title']").attr("content");
        if (titleMeta) {
            name = titleMeta.replace(/\s*最新章节.*$/, "").replace(/\s*思兔阅读.*$/, "").trim();
        }
    }
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
    if (!cover) {
        var coverImg = doc.select("img").first();
        if (coverImg) {
            cover = coverImg.attr("src") || coverImg.attr("data-src") || "";
            if (cover.startsWith("//")) cover = "https:" + cover;
            if (cover && !cover.startsWith("http")) cover = HOST + cover;
        }
    }

    var author = "";
    var authorMatch = bodyText.match(/作者[：:]\s*([^\s\n<]+)/);
    if (authorMatch) {
        author = authorMatch[1].replace(/<[^>]+>/g, "").trim();
    }
    if (!author) {
        var authorEl = doc.select(".author, [class*='author']").first();
        if (authorEl) {
            author = authorEl.text().replace(/作者[：:]\s*/g, "").trim();
        }
    }

    var desc = "";
    var descEl = doc.select(".intro, [class*='intro'], [class*='desc'], #intro").first();
    if (descEl) {
        desc = descEl.text().trim();
    }
    // Trang sto55 để trống .bookintro, nên lấy cả mô tả lẫn metadata từ sto9.
    var remoteMetadata = fetchBookMetadata(name, bookId);
    if (!desc) desc = remoteMetadata.description;
    if (!author) author = remoteMetadata.author;

    var statusMatch = bodyText.match(/(連載中|连载中|連載|连载|完結|完结|完本|全本)/);
    var status = remoteMetadata.status || (statusMatch ? statusMatch[0] : "連載");
    var ongoing = !/(完結|完结|完本|全本)/.test(status);

    var category = remoteMetadata.category || "";
    var catMatch = bodyText.match(/(?:分類|分类)[：:]\s*([^\s\n<]+)/);
    if (!category && catMatch) category = catMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!category) {
        var categoryEl = doc.select(".breadcrumb a[href*='/class_']").last();
        if (categoryEl) category = categoryEl.text().trim();
    }

    var wordCount = remoteMetadata.wordCount || "";
    var wcMatch = bodyText.match(/([\d.]+\s*(?:萬|万)?字)/);
    if (!wordCount && wcMatch) wordCount = wcMatch[0];

    var updated = remoteMetadata.updated || "";
    if (!updated) {
        var updateText = doc.select(".booktime").text();
        updated = valueAfterLabel(updateText, /^(?:更新時間|更新时间)[：:]\s*(.+)$/);
    }

    var detail = [];
    if (author) detail.push("作者：" + author);
    if (category) detail.push("分類：" + category);
    detail.push("狀態：" + status);
    if (wordCount) detail.push("字數：" + wordCount);
    if (updated) detail.push("更新：" + updated);

    var introduction = buildIntroduction(name, author, desc);
    var genres = buildGenres(category);

    return Response.success({
        name: name || "未知书名",
        cover: cover,
        author: author || "",
        description: introduction,
        detail: detail.join("<br>"),
        ongoing: ongoing,
        genres: genres,
        host: HOST
    });
}
