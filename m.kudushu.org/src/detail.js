var HOST = "https://m.kudushu.org";
var COVER_HOST = "https://www.kudushu.org";

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
    return /Just a moment|Checking your browser|Enable JavaScript and cookies|cf[-_]chl|challenges\.cloudflare\.com/i.test(text);
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
        var doc = browser.launch(url, 25000);
        if (isBlocked(doc)) {
            sleep(4000);
            doc = browser.launch(url, 25000);
        }
        return isBlocked(doc) ? null : doc;
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

function execute(url) {
    var bookId = getBookId(url);
    if (!bookId) return null;

    var doc = loadDoc(HOST + "/book/" + bookId + "/");
    if (!doc) return null;

    var title = firstText(doc, ".cataloginfo h3, .book-info h1, .book-title h1, h1");
    if (!title) title = firstAttr(doc, "meta[property='og:title']", "content");
    title = title.replace(/(?:全文阅读|[-_|]\s*苦读书).*$/, "").trim();

    var author = firstAttr(doc, "meta[property='og:novel:author']", "content");
    if (!author) author = infoValue(doc, ["作者", "作者："]);

    var type = firstAttr(doc, "meta[property='og:novel:category']", "content");
    if (!type) type = infoValue(doc, ["类型", "分类"]);

    var updated = firstAttr(doc, "meta[property='og:novel:update_time']", "content");
    if (!updated) updated = infoValue(doc, ["更新时间", "更新"]);

    var latest = infoValue(doc, ["最新章节", "最新章"]);
    if (!latest) latest = firstText(doc, ".infotype p a, .latest a");

    var cover = firstAttr(doc, ".infohead .pic img, .bookcover img, .cover img, img[src*='/files/article/image/']", "data-src");
    if (!cover) cover = firstAttr(doc, ".infohead .pic img, .bookcover img, .cover img, img[src*='/files/article/image/']", "src");
    if (!cover) cover = firstAttr(doc, "meta[property='og:image']", "content");
    cover = cover ? toUrl(cover) : buildCover(bookId);

    var description = firstText(doc, ".intro p, .intro, .description, #intro, [class*='summary']");
    description = description.replace(/^(?:本书简介|简介)[：:]?\s*/, "");
    if (!description) description = firstAttr(doc, "meta[name='description']", "content");

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
        host: HOST
    });
}
