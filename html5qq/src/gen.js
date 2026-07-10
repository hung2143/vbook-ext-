var API_HOST = "https://bookshelf.html5.qq.com";
var RANK_API = API_HOST + "/qbread/api/rank/list";
var CATEGORY_REFERER = API_HOST + "/qbread/categorylist?ch=001995&groupid=1501";

function buildRankUrl(input, page) {
    var value = String(input || "").replace(/\{\{page\}\}/g, String(page));

    // Genre cũ truyền query string, nhưng home cũ truyền cả URL API.
    // Hỗ trợ cả hai để URL không bao giờ bị ghép API hai lần.
    if (/^https?:\/\//i.test(value)) return value;

    value = value.replace(/^\?/, "");
    if (!/(^|&)ch=/.test(value)) value = "ch=001995&" + value;
    return RANK_API + "?" + value;
}

function buildDescription(book) {
    var parts = [];
    if (book.author) parts.push(book.author);
    if (book.subject) parts.push(book.subject + (book.subtype ? "・" + book.subtype : ""));
    if (book.summary) parts.push(book.summary);
    return parts.join("<br>");
}

function execute(input, page) {
    var pageNumber = parseInt(page || "1", 10);
    if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;

    var response = fetch(buildRankUrl(input, pageNumber), {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": CATEGORY_REFERER
        }
    });

    if (!response || !response.ok) return Response.success([], null);

    var doc = response.json() || {};
    var rows = Array.isArray(doc.rows) ? doc.rows : [];
    var data = [];

    rows.forEach(function(book) {
        var bookId = book.resourceID || book.resourceId || book.bookid || book.bookId;
        if (!bookId || !book.resourceName) return;

        data.push({
            name: book.resourceName,
            link: "https://novel.html5.qq.com/portal/novel-intro?bookid=" + bookId,
            cover: book.picCDN || book.picurl || "",
            description: buildDescription(book),
            host: "https://novel.html5.qq.com"
        });
    });

    return Response.success(data, rows.length > 0 ? String(pageNumber + 1) : null);
}
