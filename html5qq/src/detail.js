var API_HOST = "https://bookshelf.html5.qq.com";
var INTRO_API = API_HOST + "/qbread/api/novel/intro-info?bookid=";

// `subject` trong API giới thiệu là thể loại cấp một, còn feed thể loại cần `groupid`.
// Plugin chỉ xuất link thể loại Nam để khớp navbar và trang thể loại.
var CATEGORY_GROUP_IDS = {
    "玄幻": "1501",
    "奇幻": "1502",
    "武侠": "1503",
    "仙侠": "1504",
    "都市": "1505",
    "历史": "1506",
    "军事": "1507",
    "悬疑": "1508",
    "科幻": "1509",
    "游戏": "1510",
    "体育": "1511",
    "二次元": "1512",
    "短篇": "1515"
};

var CATEGORY_LABELS = {
    "玄幻": "huyền huyễn",
    "奇幻": "kỳ huyễn",
    "武侠": "võ hiệp",
    "仙侠": "tiên hiệp",
    "都市": "đô thị",
    "历史": "lịch sử",
    "军事": "quân sự",
    "悬疑": "huyền nghi",
    "科幻": "khoa huyễn",
    "游戏": "võng du",
    "体育": "thể thao",
    "二次元": "nhị thứ nguyên",
    "短篇": "đoản thiên"
};

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

function pad(value) {
    return value < 10 ? "0" + value : String(value);
}

function formatUpdateTime(value) {
    var timestamp = Number(value || 0);
    if (!timestamp) return "";
    if (timestamp < 1000000000000) timestamp *= 1000;

    var date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function cleanText(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
}

function groupIdForBook(book, subject) {
    if (Number(book.sex) === 2) return "";
    return CATEGORY_GROUP_IDS[subject] || "";
}

function buildGenres(book) {
    var subject = cleanText(book.subject);
    var subtype = cleanText(book.subtype);
    var groupId = groupIdForBook(book, subject);
    if (!subject || !groupId) return [];

    var title = subtype || CATEGORY_LABELS[subject] || subject;
    var input = "groupid=" + groupId + (subtype ? "&sub=" + subtype : "");

    return [{
        title: "[Nam]-" + title + "-đổi mới",
        input: "mode=updated&" + input,
        script: "feed.js"
    }, {
        title: "[Nam]-" + title + "-lượt đọc",
        input: "mode=reads&" + input,
        script: "feed.js"
    }];
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
    if (book.lastSerialname) detail.push("最新章节：" + book.lastSerialname);

    var updateTime = formatUpdateTime(book.lastUpdatetime || book.lastSerialUpdateTime);
    if (updateTime) detail.push("最新更新：" + updateTime);

    return Response.success({
        name: book.resourceName,
        cover: book.picCDN || book.picurl || "",
        author: book.author || "",
        description: toLineBreaks(book.summary || book.splitSummary),
        detail: detail.join("<br>"),
        ongoing: !book.isfinish,
        genres: buildGenres(book),
        host: API_HOST
    });
}
