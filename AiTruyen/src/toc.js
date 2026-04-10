// toc.js - Lấy danh sách chương truyện trên AiTruyen
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return HOST + link;
    return link;
}

function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function parseChapterNum(url) {
    var m = (url || "").match(/\/chuong-(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
}

function pushChapter(list, seen, chapUrl, chapName) {
    if (!chapUrl || seen[chapUrl]) return;
    seen[chapUrl] = true;
    list.push({
        name: chapName || ("Chương " + parseChapterNum(chapUrl)),
        url: chapUrl,
        host: HOST
    });
}

function extractFromHtml(slug, doc, html, list, seen) {
    var anchors = doc.select("a[href*='/truyen/" + slug + "/chuong-']");
    for (var i = 0; i < anchors.size(); i++) {
        var a = anchors.get(i);
        var href = normalizeUrl(a.attr("href") || "");
        if (!href) continue;
        var name = "";
        var mName = normalizeText(a.text()).match(/(Chương\s*\d+[^•]*)/i);
        if (mName) name = normalizeText(mName[1]);
        if (!name) {
            var n = parseChapterNum(href);
            name = n > 0 ? ("Chương " + n) : "Chương";
        }
        pushChapter(list, seen, href, name);
    }

    if (list.length > 0) return;

    var re = new RegExp('https?:\\/\\/aitruyen\\.net\\/truyen\\/' + slug + '\\/chuong-(\\d+)', 'gi');
    var m;
    while ((m = re.exec(html || "")) !== null) {
        var n2 = parseInt(m[1], 10);
        if (!n2) continue;
        var u = "https://aitruyen.net/truyen/" + slug + "/chuong-" + n2;
        pushChapter(list, seen, u, "Chương " + n2);
    }
}

function fetchJson(url, referer) {
    var resp = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": referer || (HOST + "/"),
            "accept": "application/json"
        }
    });
    if (!resp.ok) return null;
    try {
        return resp.json();
    } catch (e) {
        return null;
    }
}

function tryApiToc(slug) {
    var out = [];
    var seen = {};

    var storyJson = fetchJson(HOST + "/api/stories/" + slug, HOST + "/");
    if (!storyJson) return out;

    var story = storyJson.story || storyJson.data || storyJson.item || storyJson;
    var storyId = story && (story.id || story.storyId || "");
    if (!storyId) return out;

    var chapterJson = fetchJson(HOST + "/api/stories/" + storyId + "/chapters?page=1&limit=5000", HOST + "/truyen/" + slug);
    if (!chapterJson) return out;

    var items = chapterJson.items || chapterJson.data || chapterJson.chapters || [];
    for (var i = 0; i < items.length; i++) {
        var c = items[i] || {};
        var cNum = c.chapterNumber || c.number || c.index || c.order || 0;
        var cUrl = c.url ? normalizeUrl(c.url) : "";
        if (!cUrl && cNum) cUrl = HOST + "/truyen/" + slug + "/chuong-" + cNum;
        if (!cUrl && c.id) cUrl = HOST + "/truyen/" + slug + "/chuong-" + c.id;
        if (!cUrl) continue;

        var cName = normalizeText(c.title || c.name || "");
        if (!cName) {
            var n = parseChapterNum(cUrl) || parseInt(cNum, 10) || (i + 1);
            cName = "Chương " + n;
        }
        pushChapter(out, seen, cUrl, cName);
    }

    return out;
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var apiData = tryApiToc(slug);
    if (apiData.length > 0) {
        apiData.sort(function(a, b) {
            return parseChapterNum(a.url) - parseChapterNum(b.url);
        });
        return Response.success(apiData);
    }

    var storyUrl = HOST + "/truyen/" + slug;
    var result = [];
    var seen = {};

    var firstResp = fetch(storyUrl + "?chapterOrder=asc", {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!firstResp.ok) return Response.success([]);

    var firstDoc = firstResp.html("utf-8");
    if (!firstDoc) return Response.success([]);

    var firstHtml = firstDoc.html() || "";
    extractFromHtml(slug, firstDoc, firstHtml, result, seen);

    var maxPage = 1;
    var pageLinks = firstDoc.select("a[href*='chapterPage=']");
    for (var p = 0; p < pageLinks.size(); p++) {
        var href = pageLinks.get(p).attr("href") || "";
        var m = href.match(/chapterPage=(\d+)/i);
        if (!m) continue;
        var n = parseInt(m[1], 10);
        if (n > maxPage) maxPage = n;
    }

    if (maxPage <= 1) {
        var totalMatch = firstHtml.match(/trong\s+tổng\s*([\d.,]+K?)\s*chương/i);
        if (totalMatch) {
            var totalStr = totalMatch[1].replace(/\./g, "").replace(",", ".");
            var total = 0;
            if (totalStr.indexOf("K") >= 0) total = Math.ceil(parseFloat(totalStr.replace("K", "")) * 1000);
            else total = parseInt(totalStr, 10);
            if (total > 0) {
                var pageSize = result.length > 0 ? result.length : 24;
                maxPage = Math.ceil(total / pageSize);
            }
        }
    }

    if (maxPage > 220) maxPage = 220;

    for (var pg = 2; pg <= maxPage; pg++) {
        var pageUrl = storyUrl + "?chapterPage=" + pg + "&chapterOrder=asc";
        var resp = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": storyUrl
            }
        });
        if (!resp.ok) break;

        var doc = resp.html("utf-8");
        if (!doc) break;

        var before = result.length;
        extractFromHtml(slug, doc, doc.html() || "", result, seen);
        if (result.length === before) {
            // Trang không thêm chương mới, dừng sớm để tránh timeout.
            break;
        }
    }

    result.sort(function(a, b) {
        return parseChapterNum(a.url) - parseChapterNum(b.url);
    });

    return Response.success(result);
}
