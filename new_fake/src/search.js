load("config.js");

function execute(key, page) {
    // Robust parameter handling for both execute(input) and execute(key, page)
    if (Array.isArray(key)) {
        page = key[1];
        key = key[0];
    }
    
    var pageNum = parseInt(page || "1", 10);
    var limit = 10;
    var offset = (pageNum - 1) * limit;

    var response = fetchPage(getUrl("/api/search"), {
        queries: {
            key: key,
            tab_type: "3",
            offset: String(offset)
        },
        timeout: 30000
    });

    if (!response || !response.ok) {
        return Response.success([]);
    }

    var obj = SafeJson(response);
    if (!obj || obj.code !== 200 || !obj.data) {
        return Response.success([]);
    }

    var searchTabs = obj.data.search_tabs;
    if (!searchTabs || !Array.isArray(searchTabs)) {
        return Response.success([]);
    }

    // Find tab with tab_type === 3
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
        var book = item.book_data[0];
        if (!book || !book.book_id) continue;

        var id = book.book_id;
        if (!seen[id]) {
            seen[id] = true;
            var name = book.book_name || book.original_book_name || "";
            var cover = book.thumb_url || book.audio_thumb_uri || "";
            var desc = book.abstract || book.book_abstract_v2 || "";

            // Convert HEIC cover
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

    var next = null;
    if (tab.has_more) {
        next = String(pageNum + 1);
    }

    return Response.success(results, next);
}
