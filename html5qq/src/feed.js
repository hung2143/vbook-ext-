var API_HOST = "https://bookshelf.html5.qq.com";
var RANK_API = API_HOST + "/qbread/api/rank/list";

var MODE_GROUPS = {
    recommend_male: ["1501", "1505", "1504", "1512"],
    recommend_female: ["1523", "1524", "1516", "1517"],
    reads: ["1501", "1505", "1504", "1523", "1524", "1516"],
    score: ["1501", "1505", "1504", "1523", "1524", "1516"],
    updated: ["1501", "1505", "1504", "1523", "1524", "1516"],
    updated_all: ["1501", "1502", "1503", "1504", "1505", "1506", "1507", "1508", "1509", "1510", "1511", "1512", "1515", "1516", "1517", "1518", "1519", "1520", "1522", "1523", "1524"],
    finished: ["1501", "1505", "1504", "1523", "1524", "1516"],
    random_finished: ["1501", "1505", "1504", "1523", "1524", "1516"]
};

function getParam(value, name) {
    var match = String(value || "").match(new RegExp("(?:^|[?&])" + name + "=([^&]+)"));
    return match ? match[1] : "";
}

function toNumber(value) {
    var number = Number(value || 0);
    return isNaN(number) ? 0 : number;
}

function fetchGroup(groupId, page) {
    var url = RANK_API + "?ch=001995&groupid=" + groupId + "&start=" + page + "&count=20&sort=0&sub=&tag=&words=&finish=";
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": API_HOST + "/qbread/categorylist?ch=001995&groupid=" + groupId
        }
    });

    if (!response || !response.ok) return [];
    var doc = response.json() || {};
    return Array.isArray(doc.rows) ? doc.rows : [];
}

function compareBooks(mode, left, right) {
    if (mode === "updated" || mode === "updated_all" || mode === "finished") {
        return toNumber(right.lastUpdatetime) - toNumber(left.lastUpdatetime);
    }

    if (mode === "reads") {
        return toNumber(right.userReadNumber || right.sValue) - toNumber(left.userReadNumber || left.sValue);
    }

    // Các danh sách 精选 sắp theo điểm trước, rồi lượt đọc để tránh chỉ hiện truyện mới.
    var scoreDiff = toNumber(right.userscore) - toNumber(left.userscore);
    if (scoreDiff !== 0) return scoreDiff;
    return toNumber(right.userReadNumber || right.sValue) - toNumber(left.userReadNumber || left.sValue);
}

function buildDescription(book) {
    var details = [];
    if (book.author) details.push(book.author);
    if (book.subject) details.push(book.subject + (book.subtype ? "・" + book.subtype : ""));
    if (book.userscore) details.push("评分 " + book.userscore);
    if (book.userReadNumber || book.sValue) details.push("阅读 " + (book.userReadNumber || book.sValue));
    if (book.summary) details.push(book.summary);
    return details.join("<br>");
}

function shuffleBooks(books) {
    for (var index = books.length - 1; index > 0; index--) {
        var randomIndex = Math.floor(Math.random() * (index + 1));
        var temporary = books[index];
        books[index] = books[randomIndex];
        books[randomIndex] = temporary;
    }
}

function execute(input, page) {
    var mode = getParam(input, "mode") || "reads";
    var groupId = getParam(input, "groupid");
    var groups = groupId ? [groupId] : (MODE_GROUPS[mode] || MODE_GROUPS.reads);
    var pageNumber = parseInt(page || "1", 10);
    if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;

    var books = [];
    var seen = {};
    var hasRows = false;

    groups.forEach(function(groupId) {
        var groupBooks = fetchGroup(groupId, pageNumber);
        if (groupBooks.length) hasRows = true;

        groupBooks.forEach(function(book) {
            var bookId = book.resourceID || book.resourceId || book.bookid || book.bookId;
            if (!bookId || !book.resourceName || seen[bookId]) return;
            if ((mode === "finished" || mode === "random_finished") && !book.isfinish) return;

            seen[bookId] = true;
            books.push(book);
        });
    });

    if (mode === "random_finished") {
        // execute() chạy lại khi người dùng kéo làm mới, nên danh sách sẽ được
        // xáo lại từ cùng tập truyện hoàn tất ở mỗi lần refresh.
        shuffleBooks(books);
    } else {
        books.sort(function(left, right) {
            return compareBooks(mode, left, right);
        });
    }

    var data = books.slice(0, 20).map(function(book) {
        var bookId = book.resourceID || book.resourceId || book.bookid || book.bookId;
        return {
            name: book.resourceName,
            link: "https://novel.html5.qq.com/portal/novel-intro?bookid=" + bookId,
            cover: book.picCDN || book.picurl || "",
            description: buildDescription(book),
            host: "https://novel.html5.qq.com"
        };
    });

    return Response.success(data, hasRows ? String(pageNumber + 1) : null);
}
