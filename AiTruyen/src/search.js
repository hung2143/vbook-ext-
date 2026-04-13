// search.js - Tìm kiếm truyện trên AiTruyen
// API cũ `/api/stories/search` đã 404, nên phải parse HTML kết quả tìm kiếm.
// Tên có dấu nằm trong h3 của card kết quả, không được fallback về slug nếu card hợp lệ.
var HOST = "https://aitruyen.net";

function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
}

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
    var imgLinks = doc.select("a[href*='/truyen/']:has(img)");
    for (var i = 0; i < imgLinks.size(); i++) {
        var anchor = imgLinks.get(i);
        var link = canonicalStoryLink(anchor.attr("href") || "");
        if (!link || coverMap[link]) continue;

        var img = anchor.select("img").first();
        if (!img) continue;
        var cover = normalizeCover(img.attr("src") || img.attr("data-src") || "");
        if (!cover) {
            var srcset = img.attr("srcset") || "";
            if (srcset) cover = normalizeCover(srcset.split(",")[0].trim().split(/\s+/)[0] || "");
        }
        if (cover) coverMap[link] = cover;
    }
    return coverMap;
}

function execute(key, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var searchUrl = HOST + "/tim-kiem?q=" + encodeURIComponent(key) + "&page=" + pageNum;
    var response = fetch(searchUrl, {
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
    var titleLinks = doc.select("a[href*='/truyen/']:has(h3)");
    var data = [];
    var seen = {};

    for (var i = 0; i < titleLinks.size(); i++) {
        var anchor = titleLinks.get(i);
        var link = canonicalStoryLink(anchor.attr("href") || "");
        if (!link || seen[link]) continue;

        var h3 = anchor.select("h3").first();
        var name = normalizeText(h3 ? h3.text() : "");
        if (!name) continue;

        var metaText = "";
        var summaryText = "";
        var metaEl = null;
        var summaryEl = null;
        try { metaEl = anchor.nextElementSibling(); } catch (e) {}
        if (metaEl) {
            metaText = normalizeText(metaEl.text());
            try { summaryEl = metaEl.nextElementSibling(); } catch (e) {}
        }
        if (summaryEl) summaryText = normalizeText(summaryEl.text());

        var desc = "";
        if (metaText && summaryText) desc = metaText + "\n" + summaryText;
        else desc = metaText || summaryText || "";

        seen[link] = true;
        data.push({
            name: name,
            link: link,
            cover: coverMap[link] || "",
            description: desc,
            host: HOST
        });
    }

    var nextPage = null;
    if (data.length > 0) {
        var nextNum = pageNum + 1;
        if (doc.select("a[href*='page=" + nextNum + "']").size() > 0) {
            nextPage = String(nextNum);
        } else {
            var pageInfo = (doc.text() || "").match(/Trang\s*(\d+)\s*\/\s*(\d+)/i);
            if (pageInfo) {
                var totalPages = parseInt(pageInfo[2], 10);
                if (!isNaN(totalPages) && totalPages > pageNum) nextPage = String(nextNum);
            }
        }
    }

    return Response.success(data, nextPage);
}
