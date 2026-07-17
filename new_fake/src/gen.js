load("config.js");

function parseUrlQueries(url) {
    var queries = {};
    var queryIndex = url.indexOf("?");
    if (queryIndex !== -1) {
        var queryStr = url.substring(queryIndex + 1);
        var hashIndex = queryStr.indexOf("#");
        if (hashIndex !== -1) {
            queryStr = queryStr.substring(0, hashIndex);
        }

        var pairs = queryStr.split("&");
        for (var i = 0; i < pairs.length; i++) {
            if (!pairs[i]) continue;
            var equalIndex = pairs[i].indexOf("=");
            var rawKey = equalIndex === -1 ? pairs[i] : pairs[i].substring(0, equalIndex);
            var rawValue = equalIndex === -1 ? "" : pairs[i].substring(equalIndex + 1);
            try {
                queries[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
            } catch (e) {
                queries[rawKey] = rawValue;
            }
        }
    }
    return queries;
}

function isFanqieLibraryUrl(url) {
    return String(url || "").indexOf("fanqienovel.com/api/author/library/book_list/") !== -1;
}

function addDetailPart(parts, value) {
    var text = cleanText(decodeText(value || ""));
    if (text && parts.indexOf(text) === -1) {
        parts.push(text);
    }
}

function execute(url, page) {
    if (!page) page = "1";
    var pageNumber = parseInt(page, 10);
    if (isNaN(pageNumber) || pageNumber < 1) pageNumber = 1;

    var officialLibrary = isFanqieLibraryUrl(url);
    var requestPage = officialLibrary ? Math.max(pageNumber - 1, 0) : pageNumber;
    var finalUrl = url.replace("{{page}}", String(requestPage));

    var parts = finalUrl.split("?");
    var baseUrl = parts[0];
    var queries = parseUrlQueries(finalUrl);
    var fetchOptions = {
        queries: queries,
        timeout: 20000,
        cache: 600
    };

    if (officialLibrary) {
        fetchOptions.headers = {
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://fanqienovel.com/library"
        };
    }

    var response = fetchPage(baseUrl, fetchOptions);

    if (!response || !response.ok) {
        return Response.error("Failed to load discover content.");
    }

    var json = SafeJson(response);
    if (!json) {
        return Response.success([]);
    }

    var list = [];
    var bookList = findBookList(json);

    if (bookList && Array.isArray(bookList)) {
        bookList.forEach(function(item) {
            var bookId = item.book_id || item.bookId || item.id;
            var name = item.book_name || item.bookName || item.title;
            if (name && bookId) {
                var cover = item.thumb_url || item.book_cover || "";
                if (cover && cover.indexOf(".heic") !== -1) {
                    cover = cover.replace(".heic", ".image");
                }
                if (cover && cover.indexOf("//") === 0) {
                    cover = "https:" + cover;
                } else if (cover && cover.indexOf("http") !== 0) {
                    cover = "https:" + cover;
                } else if (cover.indexOf("http://") === 0) {
                    cover = "https://" + cover.substring(7);
                }

                var detailParts = [];
                addDetailPart(detailParts, item.category || item.tags);
                if (item.score !== undefined && item.score !== null && item.score !== "") {
                    addDetailPart(detailParts, decodeText(item.score) + "分");
                }
                if (officialLibrary) {
                    addDetailPart(detailParts, item.word_count);
                    addDetailPart(detailParts, item.read_count);
                }

                list.push({
                    name: decodeText(name),
                    cover: cover,
                    author: decodeText(item.author || ""),
                    description: decodeText(item.abstract || item.description || ""),
                    detail: detailParts.join(" | "),
                    link: "https://fanqienovel.com/page/" + bookId,
                    host: "https://fanqienovel.com"
                });
            }
        });
    }

    var next = null;
    if (officialLibrary) {
        if (json.data && json.data.has_more === true) {
            next = String(pageNumber + 1);
        }
    } else if (list.length >= 10) {
        next = String(pageNumber + 1);
    }

    return Response.success(list, next);
}

function findBookList(obj) {
    if (!obj) return null;
    if (Array.isArray(obj)) return obj;
    var keys = ["data", "book_list", "list", "ret_data"];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (obj[k]) {
            if (Array.isArray(obj[k])) return obj[k];
            var sub = findBookList(obj[k]);
            if (sub) return sub;
        }
    }
    return null;
}
