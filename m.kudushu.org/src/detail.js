var HOST = "https://m.kudushu.org";
var COVER_HOST = "https://www.kudushu.org";
var BROWSER_TIMEOUT = 15000;
var CHALLENGE_RETRIES = 2;
var CHALLENGE_WAIT = 8000;

var GENRE_IDS = {
    "玄幻魔法": 1,
    "玄幻奇幻": 1,
    "玄幻": 1,
    "武侠修真": 2,
    "武侠仙侠": 2,
    "仙侠修真": 2,
    "都市言情": 3,
    "都市小说": 3,
    "都市": 3,
    "历史军事": 4,
    "历史": 4,
    "军事": 4,
    "侦探推理": 5,
    "网游动漫": 6,
    "游戏竞技": 6,
    "科幻小说": 7,
    "科幻": 7,
    "恐怖灵异": 8,
    "灵异": 8,
    "言情小说": 9,
    "古代言情": 9,
    "现代言情": 9,
    "言情": 9,
    "其他类型": 10,
    "其它类型": 10,
    "经部": 11,
    "史书": 12,
    "子部": 13,
    "集部": 14,
    "四库之外": 15,
    "古典书籍": 16,
    "诗歌": 17,
    "宋词": 18
};

function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}

function toUrl(link) {
    link = cleanText(link);
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (/^https?:/i.test(link)) return link.replace(/^http:\/\//i, "https://");
    return HOST + (link.charAt(0) === "/" ? link : "/" + link);
}

function getBookId(url) {
    var match = String(url || "").match(/\/(?:book|html)\/(\d+)/i);
    return match ? match[1] : "";
}

function buildCover(bookId) {
    var id = parseInt(bookId, 10);
    if (isNaN(id)) return "";
    return COVER_HOST + "/files/article/image/" + Math.floor(id / 1000) + "/" + id + "/" + id + "s.jpg";
}

function isBlocked(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    var html = "";
    try { html = doc.html() || ""; } catch (ignore) {}
    return /Just a moment|Checking your browser|Performing security verification|Verify you are human|Enable JavaScript and cookies|Attention Required|Access denied|Cloudflare Ray ID|cf[-_]chl|challenges\.cloudflare\.com|cf-turnstile-response/i.test(text + " " + html);
}

function loadWithBrowser(browser, url) {
    var doc = browser.launch(url, BROWSER_TIMEOUT);

    for (var i = 0; i < CHALLENGE_RETRIES && isBlocked(doc); i++) {
        Console.log("kudushu detail: waiting for Cloudflare (" + (i + 1) + "/" + CHALLENGE_RETRIES + ")");
        sleep(CHALLENGE_WAIT + i * 4000);
        try { doc = browser.html(); } catch (ignore) {}
        if (!isBlocked(doc)) break;
        doc = browser.launch(url, BROWSER_TIMEOUT);
    }

    return isBlocked(doc) ? null : doc;
}

function loadDoc(url) {
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
            var fetched = response.html();
            if (!isBlocked(fetched)) return fetched;
        }
    } catch (ignore) {}

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        return loadWithBrowser(browser, url);
    } catch (e) {
        Console.log("kudushu detail: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
    }
}

function firstText(doc, selector) {
    var element = doc.select(selector).first();
    return element ? cleanText(element.text()) : "";
}

function firstAttr(doc, selector, attr) {
    var element = doc.select(selector).first();
    return element ? cleanText(element.attr(attr)) : "";
}

function cleanTitle(value) {
    return cleanText(value)
        .replace(/\s*(?:全文阅读|全文閱讀|最新章节|最新章節).*$/i, "")
        .replace(/\s*[-_|]\s*(?:苦读书|苦讀書).*$/i, "")
        .replace(/^《\s*(.*?)\s*》$/, "$1")
        .trim();
}

function isTitle(value) {
    return !!value && !/^(?:苦读书|苦讀書|首页|首頁|书架|書架)$/i.test(value);
}

function titleFromMeta(value) {
    value = cleanTitle(value);
    // OG title của Kudushu thường có dạng "Tên truyện, tác giả, ...".
    // Chỉ tách theo mẫu này ở metadata; tên hiển thị trên trang được giữ nguyên.
    var match = value.match(/^(.+?)[,，][^,，]+[,，]/);
    return cleanTitle(match ? match[1] : value);
}

function extractTitle(doc) {
    var selectors = [
        ".cataloginfo h1", ".book-info h1", ".book-title h1", "#info h1", "h1",
        ".cataloginfo h3", ".book-info h3", ".book-title h3"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var title = cleanTitle(firstText(doc, selectors[i]));
        if (isTitle(title)) return title;
    }

    var metaTitle = firstAttr(doc, "meta[property='og:novel:book_name']", "content");
    if (!metaTitle) metaTitle = firstAttr(doc, "meta[property='og:title']", "content");
    return titleFromMeta(metaTitle);
}

function valueAfterLabel(value, label) {
    value = cleanText(value);
    if (value.indexOf(label) !== 0) return "";
    return value.substring(label.length).replace(/^[：:\s]+/, "").trim();
}

function infoValue(doc, labels) {
    var result = "";
    doc.select(".infotype p, .book-info p, .info p, .cataloginfo p, .infotype li").forEach(function(element) {
        if (result) return;
        var text = cleanText(element.text());
        for (var i = 0; i < labels.length; i++) {
            var value = valueAfterLabel(text, labels[i]);
            if (value) {
                result = value;
                return;
            }
        }
    });
    return result;
}

function cleanDescription(value) {
    return cleanText(value)
        .replace(/^(?:本书简介|本書簡介|简介|簡介)[：:]?\s*/, "")
        .replace(/(?:最新章节推荐地址|最新章節推薦地址|最新网址|最新網址)[：:].*$/i, "")
        .trim();
}

function extractDescription(doc) {
    var description = "";
    var selectors = [
        "#intro", ".intro", ".bookintro", ".book-intro", ".description",
        ".book-description", "[class*='summary']"
    ];

    for (var i = 0; i < selectors.length; i++) {
        doc.select(selectors[i]).forEach(function(element) {
            var value = cleanDescription(element.text());
            if (value && value.length > description.length) description = value;
        });
        if (description) return description;
    }

    // Một số template cũ không gắn class cho phần giới thiệu.
    doc.select("p").forEach(function(element) {
        var value = cleanText(element.text());
        if (/^(?:本书简介|本書簡介|简介|簡介)[：:]/.test(value)) {
            value = cleanDescription(value);
            if (value.length > description.length) description = value;
        }
    });
    if (description) return description;

    description = firstAttr(doc, "meta[name='description']", "content");
    if (!description) description = firstAttr(doc, "meta[property='og:description']", "content");
    return cleanDescription(description);
}

function genreId(title) {
    return GENRE_IDS[cleanText(title)] || 0;
}

function genreIdFromHref(href) {
    var match = String(href || "").match(/\/sort\/(\d+)\//i);
    if (!match) match = String(href || "").match(/[?&]sortid=(\d+)/i);
    var id = match ? parseInt(match[1], 10) : 0;
    return id >= 1 && id <= 18 ? id : 0;
}

function categoryEntry(title, href) {
    title = cleanText(title);
    var id = genreIdFromHref(href) || genreId(title);
    return title && id ? { title: title, id: id } : null;
}

function extractCategory(doc) {
    var selectors = [".infotype p", ".book-info p", ".info p", ".cataloginfo p", ".infotype li"];

    for (var i = 0; i < selectors.length; i++) {
        var found = null;
        doc.select(selectors[i]).forEach(function(element) {
            if (found) return;

            var text = cleanText(element.text());
            if (!/^(?:类型|分类|分類)[：:]/.test(text)) return;

            element.select("a[href]").forEach(function(anchor) {
                if (!found) found = categoryEntry(anchor.text(), anchor.attr("href"));
            });

            if (!found) {
                found = categoryEntry(text.replace(/^(?:类型|分类|分類)[：:]\s*/, ""), "");
            }
        });
        if (found) return found;
    }

    // Có template đặt link thể loại ngoài dòng thông tin nhưng vẫn dùng URL /sort/{id}/.
    var linkSelectors = [
        ".infotype a[href*='/sort/']", ".book-info a[href*='/sort/']",
        ".info a[href*='/sort/']", ".cataloginfo a[href*='/sort/']"
    ];
    for (var j = 0; j < linkSelectors.length; j++) {
        var linkedCategory = null;
        doc.select(linkSelectors[j]).forEach(function(anchor) {
            if (!linkedCategory) linkedCategory = categoryEntry(anchor.text(), anchor.attr("href"));
        });
        if (linkedCategory) return linkedCategory;
    }

    // Chỉ dùng metadata khi nó khớp danh mục hợp lệ. Kudushu đôi khi ghi nhầm
    // tiêu đề chương mới nhất vào og:novel:category.
    return categoryEntry(firstAttr(doc, "meta[property='og:novel:category']", "content"), "");
}

function buildGenres(category) {
    if (!category || !category.title || !category.id) return [];
    return [{
        title: category.title,
        input: HOST + "/sort/" + category.id + "/1.html",
        script: "book.js"
    }];
}

function execute(url) {
    var bookId = getBookId(url);
    if (!bookId) return null;

    var doc = loadDoc(HOST + "/book/" + bookId + "/");
    if (!doc) return Response.error("Kudushu đang yêu cầu xác minh Cloudflare. Hãy thử lại sau khi mở trang nguồn trong trình duyệt.");

    var title = extractTitle(doc);

    var author = firstAttr(doc, "meta[property='og:novel:author']", "content");
    if (!author) author = infoValue(doc, ["作者", "作者："]);

    var category = extractCategory(doc);
    var type = category ? category.title : "";

    var updated = firstAttr(doc, "meta[property='og:novel:update_time']", "content");
    if (!updated) updated = infoValue(doc, ["更新时间", "更新"]);

    var latest = infoValue(doc, ["最新章节", "最新章"]);
    if (!latest) latest = firstText(doc, ".infotype p a, .latest a");

    var cover = firstAttr(doc, ".infohead .pic img, .bookcover img, .cover img, img[src*='/files/article/image/']", "data-src");
    if (!cover) cover = firstAttr(doc, ".infohead .pic img, .bookcover img, .cover img, img[src*='/files/article/image/']", "src");
    if (!cover) cover = firstAttr(doc, "meta[property='og:image']", "content");
    cover = cover ? toUrl(cover) : buildCover(bookId);

    var description = extractDescription(doc);

    var status = firstAttr(doc, "meta[property='og:novel:status']", "content");
    if (!status) status = infoValue(doc, ["状态"]);
    var ongoing = !/(?:完结|完本|已完)/.test(status);

    var detail = [];
    if (author) detail.push("Tác giả: " + author);
    if (type) detail.push("Thể loại: " + type);
    detail.push("Trạng thái: " + (ongoing ? "Đang ra" : "Hoàn thành"));
    if (updated) detail.push("Cập nhật: " + updated);
    if (latest) detail.push("Mới nhất: " + latest);

    return Response.success({
        name: title || "Kudushu",
        cover: cover,
        author: author,
        description: description || title,
        detail: detail.join("<br>"),
        ongoing: ongoing,
        genres: buildGenres(category),
        host: HOST
    });
}
