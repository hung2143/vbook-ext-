load("config.js");

var FANQIE_LIBRARY_API = "https://fanqienovel.com/api/author/library/book_list/v0/";
var LIBRARY_SORTS = [
    { title: "最热", value: "0" },
    { title: "最新", value: "1" },
    { title: "字数", value: "2" }
];

function parseGenreQueries(url) {
    var queries = {};
    if (!url) return queries;

    var queryIndex = url.indexOf("?");
    if (queryIndex === -1) return queries;

    var queryString = url.substring(queryIndex + 1);
    var hashIndex = queryString.indexOf("#");
    if (hashIndex !== -1) {
        queryString = queryString.substring(0, hashIndex);
    }

    queryString.split("&").forEach(function(pair) {
        if (!pair) return;
        var equalIndex = pair.indexOf("=");
        var rawKey = equalIndex === -1 ? pair : pair.substring(0, equalIndex);
        var rawValue = equalIndex === -1 ? "" : pair.substring(equalIndex + 1);
        try {
            queries[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
        } catch (e) {
            queries[rawKey] = rawValue;
        }
    });

    return queries;
}

function cleanSectionTitle(title) {
    return String(title || "").replace(/[°・\*\.☆\s]/g, "").trim();
}

function buildLibraryUrl(sourceUrl, sortValue) {
    var queries = parseGenreQueries(sourceUrl);
    var categoryId = queries.type || queries.category_id;
    var gender = queries.gender;

    if (!categoryId || gender === undefined || gender === null || gender === "") {
        return "";
    }

    return FANQIE_LIBRARY_API
        + "?page_count=20"
        + "&page_index={{page}}"
        + "&gender=" + encodeURIComponent(gender)
        + "&category_id=" + encodeURIComponent(categoryId)
        + "&creation_status=-1"
        + "&word_count=-1"
        + "&book_type=-1"
        + "&sort=" + encodeURIComponent(sortValue);
}

function appendGenreItems(genres, data, prefix) {
    var currentSection = "";

    data.forEach(function(item) {
        if (!item || !item.url) {
            if (item && item.title) {
                currentSection = cleanSectionTitle(item.title);
            }
            return;
        }
        if (!item.title) return;

        var title = item.title;
        if (title === "全部" && currentSection) {
            title = currentSection;
        }

        var queries = parseGenreQueries(item.url);
        var isRanking = currentSection === "排行榜" || queries.is_ranking === "1";
        if (isRanking) {
            genres.push({
                title: prefix + title,
                input: item.url,
                script: "gen.js"
            });
            return;
        }

        var added = false;
        LIBRARY_SORTS.forEach(function(sort) {
            var input = buildLibraryUrl(item.url, sort.value);
            if (!input) return;

            genres.push({
                title: prefix + title + " · " + sort.title,
                input: input,
                script: "gen.js"
            });
            added = true;
        });

        // Preserve future source items that do not expose category/gender metadata.
        if (!added) {
            genres.push({
                title: prefix + title,
                input: item.url,
                script: "gen.js"
            });
        }
    });
}

function addFallbackCategory(genres, prefix, title, categoryId, gender) {
    LIBRARY_SORTS.forEach(function(sort) {
        genres.push({
            title: prefix + title + " · " + sort.title,
            input: FANQIE_LIBRARY_API
                + "?page_count=20"
                + "&page_index={{page}}"
                + "&gender=" + encodeURIComponent(gender)
                + "&category_id=" + encodeURIComponent(categoryId)
                + "&creation_status=-1"
                + "&word_count=-1"
                + "&book_type=-1"
                + "&sort=" + encodeURIComponent(sort.value),
            script: "gen.js"
        });
    });
}

function execute() {
    var genres = [];

    var resMale = fetchPage(getUrl("/api/discover/style"), {
        queries: { tab: "小说", source_type: "男频" },
        timeout: 15000
    });
    if (resMale && resMale.ok) {
        var objMale = SafeJson(resMale);
        if (objMale && objMale.code === 200 && Array.isArray(objMale.data)) {
            appendGenreItems(genres, objMale.data, "[男] ");
        }
    }

    var resFemale = fetchPage(getUrl("/api/discover/style"), {
        queries: { tab: "小说", source_type: "女频" },
        timeout: 15000
    });
    if (resFemale && resFemale.ok) {
        var objFemale = SafeJson(resFemale);
        if (objFemale && objFemale.code === 200 && Array.isArray(objFemale.data)) {
            appendGenreItems(genres, objFemale.data, "[女] ");
        }
    }

    if (genres.length === 0) {
        addFallbackCategory(genres, "[男] ", "都市", "1", "1");
        addFallbackCategory(genres, "[男] ", "玄幻", "7", "1");
        addFallbackCategory(genres, "[男] ", "科幻", "11", "1");
        addFallbackCategory(genres, "[女] ", "现代言情", "3", "0");
    }

    return Response.success(genres);
}
