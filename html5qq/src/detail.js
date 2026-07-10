var API_HOST = "https://bookshelf.html5.qq.com";
var INTRO_API = API_HOST + "/qbread/api/novel/intro-info?bookid=";

function getBookId(url) {
    var value = String(url || "");
    var match = value.match(/[?&](?:bookid|book_id|resourceid)=([0-9]+)/i);
    if (match) return match[1];

    // Một số link chia sẻ cũ không có query chuẩn nhưng vẫn kết thúc bằng ID.
    match = value.match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : "";
}

function toLineBreaks(value) {
    return String(value || "").replace(/\r?\n/g, "<br>");
}

function execute(url) {
    var bookId = getBookId(url);
    if (!bookId) return null;

    var response = fetch(INTRO_API + bookId, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": API_HOST + "/qbread/intro?bookid=" + bookId
        }
    });

    if (!response || !response.ok) return null;

    var doc = response.json() || {};
    var book = doc.data && doc.data.bookInfo;
    if (!book || !book.resourceName) return null;

    var detail = [];
    if (book.author) detail.push("作者：" + book.author);
    if (book.subject) detail.push("分类：" + book.subject + (book.subtype ? "・" + book.subtype : ""));
    detail.push("状态：" + (book.isfinish ? "完结" : "连载中"));
    if (book.serialnum) detail.push("章节：" + book.serialnum);
    if (book.contentsize) detail.push("字数：" + book.contentsize);

    return Response.success({
        name: book.resourceName,
        cover: book.picCDN || book.picurl || "",
        author: book.author || "",
        description: toLineBreaks(book.summary || book.splitSummary),
        detail: detail.join("<br>"),
        ongoing: !book.isfinish,
        host: API_HOST
    });
}
