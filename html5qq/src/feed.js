var API_HOST = "https://bookshelf.html5.qq.com";
var GRAPHQL_API = "https://novel.html5.qq.com/be-api/gql";
var RANK_API = API_HOST + "/qbread/api/rank/list";
var GROUPS_PER_LOAD = 2;
var GRAPHQL_RETRY_BATCH_SIZE = 6;
var NEWEST_SCAN_SIZE = 10000;
var PAGE_SIZE = 20;
var TOKEN_PAGE_COUNT = 10;

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

function validGroupIds(groups) {
    return groups.filter(function(groupId) {
        return /^\d+$/.test(String(groupId || ""));
    });
}

function postGraphQL(query) {
    var response;
    try {
        response = fetch(GRAPHQL_API, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": UserAgent.android(),
                "referer": "https://novel.html5.qq.com/"
            },
            body: JSON.stringify({ query: query })
        });
    } catch (error) {
        return null;
    }

    if (!response || !response.ok) return null;
    var doc = response.json() || {};
    return doc.data || null;
}

function buildGroupConditions(groups, after) {
    return groups.map(function(groupId) {
        return "{id:" + groupId + " condName:\"newest\" sortBy:GroupSortByHot " +
            "pageQuery:{first:" + NEWEST_SCAN_SIZE + " after:\"" + after + "\"}}";
    }).join(",");
}

function scanGroupBatch(groups, newestById) {
    var pending = groups.slice();
    var after = 0;

    while (pending.length) {
        // Alias ngắn giảm hơn một nửa JSON phải tải và parse: groups/info/books/
        // bookBaseInfo/id/lastUpdateTime -> g/i/b/x/i/t.
        var query = "query{g:groups(param:{cond:[" + buildGroupConditions(pending, after) + "]})" +
            "{i:info{b:books{x:bookBaseInfo{i:id t:lastUpdateTime}}}}}";
        var data = postGraphQL(query);
        if (!data || !Array.isArray(data.g)) return false;

        var nextPending = [];
        pending.forEach(function(groupId, groupIndex) {
            var group = data.g[groupIndex] || {};
            var infoList = Array.isArray(group.i) ? group.i : [];
            var count = 0;

            infoList.forEach(function(info) {
                var books = info && Array.isArray(info.b) ? info.b : [];
                count += books.length;

                books.forEach(function(item) {
                    var baseInfo = item && item.x;
                    var bookId = baseInfo && String(baseInfo.i || "");
                    if (!bookId) return;

                    var updateTime = toNumber(baseInfo.t);
                    if (!newestById[bookId] || updateTime > newestById[bookId].lastUpdateTime) {
                        newestById[bookId] = {
                            id: bookId,
                            lastUpdateTime: updateTime
                        };
                    }
                });
            });

            // `after` của QQ là vị trí bắt đầu. Chỉ đọc trang kế khi trang hiện tại
            // đã đầy, nhờ vậy vẫn bao phủ thể loại vượt quá 10.000 truyện.
            if (count >= NEWEST_SCAN_SIZE) nextPending.push(groupId);
        });

        pending = nextPending;
        after += NEWEST_SCAN_SIZE;
    }

    return true;
}

function scanNewestBooks(groups) {
    groups = validGroupIds(groups);
    if (!groups.length) return [];

    var newestById = {};
    // Gộp các thể loại vào một request để tránh 4 lượt chờ nối tiếp. Nếu máy
    // chủ từ chối response lớn, tự hạ xuống các cụm nhỏ và thử lại.
    if (!scanGroupBatch(groups, newestById)) {
        newestById = {};
        for (var index = 0; index < groups.length; index += GRAPHQL_RETRY_BATCH_SIZE) {
            var batch = groups.slice(index, index + GRAPHQL_RETRY_BATCH_SIZE);
            if (!scanGroupBatch(batch, newestById)) return null;
        }
    }

    return Object.keys(newestById).map(function(bookId) {
        return newestById[bookId];
    });
}

function fetchBooksByIds(bookIds) {
    if (!bookIds.length) return [];

    var ids = bookIds.map(function(bookId) {
        return "\"" + String(bookId).replace(/[^0-9]/g, "") + "\"";
    }).join(",");
    var query = "query{books(ids:[" + ids + "]){id baseInfo{" +
        "id name author category1 category2 category3 picURL summary isFinished " +
        "contentSize lastUpdateTime latestChapterName tag}}}";
    var data = postGraphQL(query);
    if (!data) data = postGraphQL(query);
    if (!data || !Array.isArray(data.books)) return null;

    return data.books.map(function(item) {
        var book = item && item.baseInfo;
        if (!book || !book.id || !book.name) return null;

        return {
            resourceID: String(book.id),
            resourceName: book.name,
            author: book.author || "",
            subject: book.category2 || book.category1 || "",
            subtype: book.category3 || "",
            picurl: book.picURL || "",
            summary: book.summary || "",
            isfinish: !!book.isFinished,
            contentsize: toNumber(book.contentSize),
            lastUpdatetime: toNumber(book.lastUpdateTime),
            lastSerialname: book.latestChapterName || "",
            tag: book.tag || ""
        };
    }).filter(function(book) {
        return !!book;
    });
}

function compareNewest(left, right) {
    var timeDifference = toNumber(right.lastUpdateTime) - toNumber(left.lastUpdateTime);
    if (timeDifference !== 0) return timeDifference;

    // QQ chỉ lưu thời gian đến giây. ID giảm dần giúp thứ tự ổn định khi nhiều
    // truyện cùng cập nhật trong một giây.
    var rightId = toNumber(right.id);
    var leftId = toNumber(left.id);
    if (rightId !== leftId) return rightId - leftId;
    return String(right.id).localeCompare(String(left.id));
}

function encodeNewestToken(pageNumber, hasMore, books) {
    var values = books.map(function(book) {
        return String(book.id) + "." + String(toNumber(book.lastUpdateTime));
    }).join(",");
    return "n;" + pageNumber + ";" + (hasMore ? "1" : "0") + ";" + values;
}

function decodeNewestToken(value) {
    var match = String(value || "").match(/^n;(\d+);([01]);(.*)$/);
    if (!match) return null;

    var books = [];
    String(match[3] || "").split(",").forEach(function(item) {
        var parts = item.split(".");
        if (!/^\d+$/.test(parts[0] || "") || !/^\d+$/.test(parts[1] || "")) return;
        books.push({ id: parts[0], lastUpdateTime: toNumber(parts[1]) });
    });

    return {
        pageNumber: parseInt(match[1], 10),
        hasMore: match[2] === "1",
        books: books
    };
}

function fetchNewestPage(groups, pageValue) {
    var token = decodeNewestToken(pageValue);
    var pageNumber = token ? token.pageNumber : parseInt(pageValue || "1", 10);
    if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;

    var selected;
    var remaining;
    var hasMore;

    if (token) {
        selected = token.books.slice(0, PAGE_SIZE);
        remaining = token.books.slice(PAGE_SIZE);
        hasMore = token.hasMore;
    } else {
        var newestBooks = scanNewestBooks(groups);
        if (newestBooks === null) return null;

        newestBooks.sort(compareNewest);
        var start = (pageNumber - 1) * PAGE_SIZE;
        var windowEnd = start + PAGE_SIZE * TOKEN_PAGE_COUNT;
        var windowBooks = newestBooks.slice(start, windowEnd);
        selected = windowBooks.slice(0, PAGE_SIZE);
        remaining = windowBooks.slice(PAGE_SIZE);
        hasMore = windowEnd < newestBooks.length;
    }

    if (!selected.length) {
        return { data: [], next: null };
    }

    var details = fetchBooksByIds(selected.map(function(book) { return book.id; }));
    if (details === null) return null;

    var detailsById = {};
    details.forEach(function(book) {
        detailsById[String(book.resourceID)] = book;
    });

    var orderedBooks = [];
    selected.forEach(function(scannedBook) {
        var book = detailsById[scannedBook.id];
        if (!book) return;

        // Dùng mốc của lần quét để thứ tự và thời gian hiển thị luôn đồng nhất.
        book.lastUpdatetime = scannedBook.lastUpdateTime;
        orderedBooks.push(book);
    });

    if (!orderedBooks.length && selected.length) return null;

    var next = null;
    if (remaining.length) {
        next = encodeNewestToken(pageNumber + 1, hasMore, remaining);
    } else if (hasMore) {
        // Sau mười trang mới cần quét lại; thao tác cuộn thông thường chỉ gọi
        // request chi tiết 20 truyện và không tải lại toàn bộ chỉ mục.
        next = String(pageNumber + 1);
    }

    return {
        data: booksToData(orderedBooks),
        next: next
    };
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

function pad(value) {
    return value < 10 ? "0" + value : String(value);
}

function formatUpdateTime(value) {
    var timestamp = toNumber(value);
    if (!timestamp) return "";
    if (timestamp < 1000000000000) timestamp *= 1000;

    var date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function buildDescription(book) {
    var details = [];
    if (book.lastSerialname) details.push("最新章节：" + shortText(book.lastSerialname, 80));

    var updateTime = formatUpdateTime(book.lastUpdatetime || book.lastSerialUpdateTime);
    if (updateTime) details.push("更新时间：" + updateTime);
    if (book.author) details.push("作者：" + book.author);
    if (book.subject) details.push("分类：" + book.subject + (book.subtype ? "・" + book.subtype : ""));
    if (book.userscore) details.push("评分：" + book.userscore);
    if (book.userReadNumber || book.sValue) details.push("阅读：" + (book.userReadNumber || book.sValue));
    if (book.summary) details.push(shortText(book.summary, 180));
    return details.join("<br>");
}

function shortText(value, limit) {
    value = String(value || "").replace(/\s+/g, " ").trim();
    return value.length > limit ? value.substring(0, limit) + "…" : value;
}

function booksToData(books) {
    return books.map(function(book) {
        var bookId = book.resourceID || book.resourceId || book.bookid || book.bookId;
        return {
            name: book.resourceName,
            link: "https://novel.html5.qq.com/portal/novel-intro?bookid=" + bookId,
            cover: book.picCDN || book.picurl || "",
            description: buildDescription(book),
            host: "https://novel.html5.qq.com"
        };
    });
}

function getGroupBatch(groups, pageNumber, hasExplicitGroup) {
    if (hasExplicitGroup) {
        return { groups: groups, sourcePage: pageNumber };
    }

    // Các feed không liên quan đến cập nhật vẫn luân phiên tối đa hai nhóm để
    // giữ tốc độ tải như trước.
    var batchCount = Math.ceil(groups.length / GROUPS_PER_LOAD);
    var batchIndex = (pageNumber - 1) % batchCount;
    var sourcePage = Math.floor((pageNumber - 1) / batchCount) + 1;
    var start = batchIndex * GROUPS_PER_LOAD;

    return {
        groups: groups.slice(start, start + GROUPS_PER_LOAD),
        sourcePage: sourcePage
    };
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

    if (mode === "updated" || mode === "updated_all") {
        var newestPage = fetchNewestPage(groups, page || "1");
        if (newestPage !== null) {
            return Response.success(newestPage.data, newestPage.next);
        }

        // Không gắn nhãn danh sách phổ biến của API cũ thành "mới cập nhật".
        // Người dùng có thể tải lại để endpoint cập nhật của QQ được thử lại.
        return Response.success([]);
    }

    var batch = getGroupBatch(groups, pageNumber, !!groupId);
    var books = [];
    var seen = {};
    var hasRows = false;

    batch.groups.forEach(function(currentGroupId) {
        var groupBooks = fetchGroup(currentGroupId, batch.sourcePage);
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

    var data = booksToData(books.slice(0, PAGE_SIZE));
    return Response.success(data, hasRows && data.length ? String(pageNumber + 1) : null);
}
