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
        name: chapName || ("Chuong " + parseChapterNum(chapUrl)),
        url: chapUrl,
        host: HOST
    });
}

// Trích chapter từ HTML doc
function extractChaptersFromDoc(slug, doc, list, seen) {
    var anchors = doc.select("a[href*='/truyen/" + slug + "/chuong-']");
    for (var i = 0; i < anchors.size(); i++) {
        var a = anchors.get(i);
        var href = a.attr("href") || "";
        href = href.split("#")[0].split("?")[0];
        if (!href || href.indexOf("/chuong-") < 0) continue;
        var chapUrl = normalizeUrl(href);

        var rawText = normalizeText(a.text());
        var chapName = "";
        var chapMatch = rawText.match(/(Chuo*ng\s*\d+[^*\n\r]{0,100})/i);
        if (chapMatch) {
            chapName = normalizeText(chapMatch[1]).replace(/\s*\u2022\s*.*$/, "").trim();
        }
        if (!chapName) {
            var n = parseChapterNum(chapUrl);
            chapName = n > 0 ? ("Chuong " + n) : "Chuong";
        }
        pushChapter(list, seen, chapUrl, chapName);
    }
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var result = [];
    var seen = {};

    // === Phương pháp 1: Thử JSON API ===
    // AiTruyen có thể có endpoint JSON cho danh sách chương
    var apiAttemptUrls = [
        HOST + "/api/stories/" + slug + "/chapters?page=1&limit=500&order=asc",
        HOST + "/api/novels/" + slug + "/chapters?page=1&limit=500&order=asc"
    ];
    var apiWorked = false;

    for (var ai = 0; ai < apiAttemptUrls.length; ai++) {
        try {
            var apiResp = fetch(apiAttemptUrls[ai], {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "accept": "application/json",
                    "referer": storyUrl
                }
            });
            if (!apiResp || !apiResp.ok) continue;
            var apiJson = apiResp.json();
            if (!apiJson) continue;

            var items = apiJson.data || apiJson.items || apiJson.chapters || apiJson.results || [];
            if (!items || items.length === 0) continue;

            var pagination = apiJson.pagination || apiJson.meta || {};
            var totalPages = pagination.totalPages || pagination.total_pages || 1;
            var limit = pagination.limit || items.length;

            // Thêm chapters từ trang 1
            for (var ci = 0; ci < items.length; ci++) {
                var item = items[ci];
                var ordinal = item.ordinal || item.order || item.chapterNumber || ci + 1;
                var chapTitle = item.title || item.name || ("Chuong " + ordinal);
                var chapHref = item.href || item.url || ("/truyen/" + slug + "/chuong-" + ordinal);
                var chapUrl2 = normalizeUrl(chapHref);
                pushChapter(result, seen, chapUrl2, chapTitle);
            }

            // Fetch trang 2 trở đi
            if (totalPages > 1 && limit > 0) {
                var maxApiPage = Math.min(totalPages, 20);
                for (var ap = 2; ap <= maxApiPage; ap++) {
                    var nextApiUrl = apiAttemptUrls[ai].replace("page=1", "page=" + ap);
                    var nextResp = fetch(nextApiUrl, {
                        headers: {
                            "user-agent": UserAgent.chrome(),
                            "accept": "application/json",
                            "referer": storyUrl
                        }
                    });
                    if (!nextResp || !nextResp.ok) break;
                    var nextJson = nextResp.json();
                    if (!nextJson) break;
                    var nextItems = nextJson.data || nextJson.items || nextJson.chapters || nextJson.results || [];
                    if (!nextItems || nextItems.length === 0) break;
                    for (var ni = 0; ni < nextItems.length; ni++) {
                        var ni2 = nextItems[ni];
                        var nOrd = ni2.ordinal || ni2.order || ni2.chapterNumber || (result.length + ni + 1);
                        var nTitle = ni2.title || ni2.name || ("Chuong " + nOrd);
                        var nHref = ni2.href || ni2.url || ("/truyen/" + slug + "/chuong-" + nOrd);
                        pushChapter(result, seen, normalizeUrl(nHref), nTitle);
                    }
                }
            }

            if (result.length > 0) {
                apiWorked = true;
                break;
            }
        } catch (e) {
            // API không hỗ trợ, thử tiếp
        }
    }

    // === Phương pháp 2 (fallback): HTML scraping ===
    if (!apiWorked) {
        var firstUrl = storyUrl + "?chapterPage=1&chapterOrder=asc";
        var firstResp = fetch(firstUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": HOST + "/"
            }
        });
        if (!firstResp || !firstResp.ok) return Response.success([]);

        var firstDoc = firstResp.html("utf-8");
        if (!firstDoc) return Response.success([]);

        extractChaptersFromDoc(slug, firstDoc, result, seen);

        // Tìm tổng số trang từ pagination links
        var maxPage = 1;
        var pageLinks = firstDoc.select("a[href*='chapterPage=']");
        for (var p = 0; p < pageLinks.size(); p++) {
            var href2 = pageLinks.get(p).attr("href") || "";
            var m2 = href2.match(/chapterPage=(\d+)/i);
            if (!m2) continue;
            var n2 = parseInt(m2[1], 10);
            if (n2 > maxPage) maxPage = n2;
        }

        // Fallback: tính từ text "Trang N/M" hoặc "tổng X.XK chương"
        if (maxPage <= 1) {
            var pageText = firstDoc.text() || "";
            // Tìm "Trang 1/M"
            var trangMatch = pageText.match(/Trang\s*\d+\s*\/\s*(\d+)/i);
            if (trangMatch) {
                maxPage = parseInt(trangMatch[1], 10) || 1;
            }
            // Hoặc "trong tổng X.XK chương"
            if (maxPage <= 1 && result.length > 0) {
                var totalMatch = pageText.match(/trong\s+t[oô]ng\s*([\d.,]+K?)\s*ch[uư][oơ]ng/i);
                if (totalMatch) {
                    var totalStr = totalMatch[1].replace(/\./g, "").replace(",", ".");
                    var total = 0;
                    if (totalStr.indexOf("K") >= 0) {
                        total = Math.ceil(parseFloat(totalStr.replace("K", "")) * 1000);
                    } else {
                        total = parseInt(totalStr, 10);
                    }
                    if (total > 0 && result.length > 0) {
                        maxPage = Math.ceil(total / result.length);
                    }
                }
            }
        }

        // Giới hạn an toàn để tránh timeout
        if (maxPage > 100) maxPage = 100;

        // Fetch trang tiếp theo
        for (var pg = 2; pg <= maxPage; pg++) {
            var pageUrl = storyUrl + "?chapterPage=" + pg + "&chapterOrder=asc";
            var pgResp = fetch(pageUrl, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": storyUrl
                }
            });
            if (!pgResp || !pgResp.ok) break;
            var pgDoc = pgResp.html("utf-8");
            if (!pgDoc) break;

            var before = result.length;
            extractChaptersFromDoc(slug, pgDoc, result, seen);
            // Dừng sớm nếu không có chương mới
            if (result.length === before && pg > 2) break;
        }
    }

    // Sort theo số chương
    result.sort(function(a, b) {
        return parseChapterNum(a.url) - parseChapterNum(b.url);
    });

    // Fix tên chương: thay "Chuong" bằng "Chương"
    for (var ri = 0; ri < result.length; ri++) {
        result[ri].name = result[ri].name.replace(/^Chuong\s+(\d+)/, "Chương $1");
    }

    return Response.success(result);
}