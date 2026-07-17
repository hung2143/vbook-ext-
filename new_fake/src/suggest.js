load("config.js");

function execute(input) {
    if (!input) return Response.success([]);

    // 1. Get author name from book detail
    var detailRes = fetchPage(getUrl("/api/detail"), {
        queries: {
            book_id: input
        },
        timeout: 20000
    });

    if (!detailRes || !detailRes.ok) {
        return Response.success([]);
    }

    var detailObj = SafeJson(detailRes);
    if (!detailObj) {
        return Response.success([]);
    }

    var book = null;
    if (detailObj && detailObj.code === 200 && detailObj.data && detailObj.data.code === 0) {
        book = detailObj.data.data;
    }
    if (Array.isArray(book)) {
        book = book[0];
    }
    if (!book || !book.author) {
        return Response.success([]);
    }

    var author = book.author;

    // 2. Search books by the same author
    var searchRes = fetchPage(getUrl("/api/search"), {
        queries: {
            key: author,
            tab_type: "3",
            offset: "0"
        },
        timeout: 20000
    });

    if (!searchRes || !searchRes.ok) {
        return Response.success([]);
    }

    var searchObj = SafeJson(searchRes);
    if (!searchObj) {
        return Response.success([]);
    }

    if (!searchObj || searchObj.code !== 200 || !searchObj.data) {
        return Response.success([]);
    }

    var searchTabs = searchObj.data.search_tabs;
    if (!searchTabs || !Array.isArray(searchTabs)) {
        return Response.success([]);
    }

    var tab = null;
    for (var i = 0; i < searchTabs.length; i++) {
        if (searchTabs[i] && searchTabs[i].tab_type === 3) {
            tab = searchTabs[i];
            break;
        }
    }

    if (!tab || !tab.data || !Array.isArray(tab.data)) {
        return Response.success([]);
    }

    var results = [];
    var seen = {};

    for (var j = 0; j < tab.data.length; j++) {
        var item = tab.data[j];
        if (!item || !item.book_data || !Array.isArray(item.book_data)) continue;
        var b = item.book_data[0];
        if (!b || !b.book_id || b.book_id === input) continue; // skip the current book

        var id = b.book_id;
        if (!seen[id]) {
            seen[id] = true;
            var name = b.book_name || b.original_book_name || "";
            var cover = b.thumb_url || b.audio_thumb_uri || "";
            var desc = b.abstract || b.book_abstract_v2 || "";

            if (cover && cover.indexOf(".heic") !== -1) {
                cover = cover.replace(".heic", ".image");
            }
            if (cover && cover.indexOf("http") !== 0) {
                cover = "https:" + cover;
            }

            results.push({
                name: decodeText(name),
                link: "https://fanqienovel.com/page/" + id,
                cover: cover,
                description: decodeText(cleanText(desc)),
                host: "https://fanqienovel.com"
            });
        }
    }

    return Response.success(results);
}
