var API_HOST = "https://bookshelf.html5.qq.com";
var INTRO_API = API_HOST + "/qbread/api/novel/intro-info?bookid=";

// `subject` trong API giới thiệu là thể loại cấp một, còn danh sách xếp hạng
// cần `groupid`.  Một số thể loại trùng tên giữa nam tần và nữ tần nên lưu
// riêng nhóm nữ để tag dẫn đến đúng danh sách.
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
    "短篇": "1515",
    "幻情": "1516",
    "青春": "1522",
    "古言": "1523",
    "现言": "1524"
};

var FEMALE_CATEGORY_GROUP_IDS = {
    "仙侠": "1517",
    "悬疑": "1518",
    "科幻": "1519",
    "游戏": "1520"
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
    if (Number(book.sex) === 2 && FEMALE_CATEGORY_GROUP_IDS[subject]) {
        return FEMALE_CATEGORY_GROUP_IDS[subject];
    }
    return CATEGORY_GROUP_IDS[subject] || "";
}

function buildGenres(book) {
    var subject = cleanText(book.subject);
    var subtype = cleanText(book.subtype);
    var groupId = groupIdForBook(book, subject);
    if (!subject || !groupId) return [];

    return [{
        title: subtype || subject,
        input: "groupid=" + groupId + "&start={{page}}&count=20&sort=0&sub=" + subtype,
        script: "gen.js"
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
