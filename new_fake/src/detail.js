load("config.js");

function execute(url) {
    var bookId = getBookId(url);
    if (!bookId) {
        return Response.error("Invalid book ID");
    }

    var requestUrl = getUrl("/api/detail") + "?book_id=" + bookId;
    var response = fetchPage(requestUrl, {
        timeout: 30000,
        cache: 86400
    });

    if (!response || !response.ok) {
        return Response.error("Cannot load book detail: " + (response ? response.status : "unknown"));
    }

    var obj = SafeJson(response);
    if (!obj) {
        return Response.error("Failed to parse book detail JSON");
    }

    var book = null;
    if (obj && obj.code === 200 && obj.data && obj.data.code === 0) {
        book = obj.data.data;
    }

    if (Array.isArray(book)) {
        book = book[0];
    }

    if (!book) {
        return Response.error("Book detail is empty (Status: " + response.status + ")");
    }
    
    // Convert HEIC cover to standard image if needed
    var cover = book.thumb_url || book.detail_page_thumb_url || book.expand_thumb_url || "";
    if (cover && cover.indexOf(".heic") !== -1) {
        cover = cover.replace(".heic", ".image");
    }
    if (cover && cover.indexOf("http") !== 0) {
        cover = "https:" + cover;
    }

    var ongoing = true;
    var statusVal = book.creation_status !== undefined ? book.creation_status : book.status;
    if (statusVal === "0" || statusVal === 0 || statusVal === "completed" || statusVal === "已完结") {
        ongoing = false;
    }

    var genres = [];
    if (book.tags) {
        var tagList = book.tags.split(",");
        for (var i = 0; i < tagList.length; i++) {
            var tag = tagList[i].trim();
            if (tag) {
                genres.push({
                    title: decodeText(tag),
                    input: tag,
                    script: "search.js"
                });
            }
        }
    }

    if (book.category) {
        var cat = book.category.trim();
        if (cat) {
            var decodedCat = decodeText(cat);
            var found = false;
            for (var j = 0; j < genres.length; j++) {
                if (genres[j].title === decodedCat) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                genres.unshift({
                    title: decodedCat,
                    input: cat,
                    script: "search.js"
                });
            }
        }
    }

    return Response.success({
        name: decodeText(book.book_name || book.original_book_name || ""),
        cover: cover,
        host: "https://fanqienovel.com",
        author: decodeText(book.author || ""),
        description: decodeText(cleanText(book.book_abstract_v2 || book.abstract || "")),
        ongoing: ongoing,
        genres: genres.length > 0 ? genres : undefined,
        suggests: [{ title: "相关推荐", input: bookId, script: "suggest.js" }],
        comments: [{ title: "全部评论", input: bookId, script: "comment.js" }]
    });
}
