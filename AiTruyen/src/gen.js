// gen.js - Lấy danh sách truyện cho 2 loại trang của AiTruyen:
// 1) /bang-xep-hang?type=...  -> 3 tab xếp hạng ở home.js
// 2) /tim-kiem?genre=...      -> danh sách truyện theo thể loại từ genre.js
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return HOST + link;
    return link;
}

function canonicalStoryLink(link) {
    var full = normalizeUrl(link);
    var match = full.match(/^(https?:\/\/[^/]+\/truyen\/[^/?#]+)/);
    return match ? match[1] : "";
}

function normalizeCover(src) {
    if (!src) return "";
    if (src.indexOf("/_next/image") >= 0) {
        var match = src.match(/url=([^&]+)/);
        if (match) src = decodeURIComponent(match[1]);
    }
    if (src.indexOf("//") === 0) return "https:" + src;
    if (src.indexOf("http") !== 0) return HOST + src;
    return src;
}

function buildCoverMap(doc) {
    var coverMap = {};
    var imageLinks = doc.select("a[href*='/truyen/']:has(img)");
    for (var i = 0; i < imageLinks.size(); i++) {
        var anchor = imageLinks.get(i);
        var href = canonicalStoryLink(anchor.attr("href") || "");
        if (!href || coverMap[href]) continue;

        var img = anchor.select("img").first();
        if (!img) continue;
        var cover = normalizeCover(img.attr("src") || img.attr("data-src") || "");
        if (!cover) {
            var srcset = img.attr("srcset") || "";
            if (srcset) cover = normalizeCover(srcset.split(",")[0].trim().split(/\s+/)[0] || "");
        }
        if (cover) coverMap[href] = cover;
    }
    return coverMap;
}

function pushNovel(list, seen, link, name, cover, description) {
    if (!link || !name) return;
    if (seen[link]) return;
    seen[link] = true;
    list.push({
        name: (name + "").trim(),
        link: link,
        cover: cover || "",
        description: description || "",
        host: HOST
    });
}

function parseRankingPage(doc, coverMap) {
    var data = [];
    var seen = {};
    var scripts = doc.select("script[type='application/ld+json']");

    for (var i = 0; i < scripts.size(); i++) {
        var jsonText = scripts.get(i).html();
        if (!jsonText || jsonText.indexOf('"@type":"ItemList"') < 0) continue;

        var regex = /"url":"(https?:\/\/aitruyen\.net\/truyen\/[^"]+)","name":"([^"]+)"/g;
        var match;
        while ((match = regex.exec(jsonText)) !== null) {
            var link = canonicalStoryLink(match[1]);
            var name = match[2];
            if (!link || !name) continue;
            pushNovel(data, seen, link, name, coverMap[link] || "", "");
        }
    }

    return data;
}

function parseSearchPage(doc, coverMap) {
    var data = [];
    var seen = {};
    var titleLinks = doc.select("a[href*='/truyen/']:has(h3)");

    for (var i = 0; i < titleLinks.size(); i++) {
        var anchor = titleLinks.get(i);
        var link = canonicalStoryLink(anchor.attr("href") || "");
        if (!link) continue;

        var h3 = anchor.select("h3").first();
        var name = h3 ? (h3.text() + "").trim() : "";
        if (!name || name.length < 2) continue;

        var description = "";
        var nextEl = null;
        try { nextEl = anchor.nextElementSibling(); } catch (e) {}
        if (nextEl) description = (nextEl.text() || "").trim();

        pushNovel(data, seen, link, name, coverMap[link] || "", description);
    }

    return data;
}

function getNextPage(doc, pageNum, dataLength) {
    if (!dataLength) return null;

    var nextNum = pageNum + 1;
    if (doc.select("a[href*='page=" + nextNum + "']").size() > 0) {
        return String(nextNum);
    }

    var pageText = (doc.text() || "").match(/Trang\s*(\d+)\s*\/\s*(\d+)/i);
    if (pageText) {
        var totalPages = parseInt(pageText[2], 10);
        if (!isNaN(totalPages) && totalPages > pageNum) return String(nextNum);
    }

    return null;
}

function execute(url, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var isGenrePage = (url || "").indexOf("?genre=") >= 0;
    var basePath = isGenrePage ? "/tim-kiem" : "/bang-xep-hang";
    var listUrl = HOST + basePath + url + "&page=" + pageNum;

    var response = fetch(listUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": HOST + "/"
        }
    });
    if (!response || !response.ok) return Response.success([], null);

    var doc = response.html("utf-8");
    if (!doc) return Response.success([], null);

    var coverMap = buildCoverMap(doc);
    var data = isGenrePage ? parseSearchPage(doc, coverMap) : parseRankingPage(doc, coverMap);
    var nextPage = getNextPage(doc, pageNum, data.length);
    return Response.success(data, nextPage);
}