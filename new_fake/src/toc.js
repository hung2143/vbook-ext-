load("config.js");

function findChapterList(obj) {
    if (!obj) return null;
    if (Array.isArray(obj)) return obj;
    var keys = ["data", "chapter_list", "list", "lists", "chapters", "directory"];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (obj[k]) {
            if (Array.isArray(obj[k])) return obj[k];
            var sub = findChapterList(obj[k]);
            if (sub) return sub;
        }
    }
    return null;
}

function execute(url) {
    var bookId = getBookId(url);
    if (!bookId) {
        return Response.success([]);
    }

    var requestUrl = getUrl("/api/directory") + "?book_id=" + bookId;
    var response = fetchPage(requestUrl, {
        timeout: 30000,
        cache: 600
    });

    if (!response || !response.ok) {
        return Response.success([]);
    }

    var obj = SafeJson(response);
    if (!obj) {
        return Response.success([]);
    }

    var chapters = [];
    var rawList = null;
    if (obj.data && Array.isArray(obj.data.lists)) {
        rawList = obj.data.lists;
    } else {
        rawList = findChapterList(obj);
    }

    if (rawList && Array.isArray(rawList)) {
        for (var i = 0; i < rawList.length; i++) {
            var item = rawList[i];
            if (!item) continue;
            var title = item.title || item.chapter_title || item.name || item.chapterName || "";
            var itemId = item.item_id || item.itemId || item.id || item.chapter_id || item.chapterId || "";
            if (title && itemId) {
                chapters.push({
                    name: decodeText(title),
                    url: "https://fanqienovel.com/reader/" + itemId,
                    host: "https://fanqienovel.com"
                });
            }
        }
    }

    return Response.success(chapters);
}
