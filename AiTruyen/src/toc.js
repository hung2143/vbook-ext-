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

// Trích chapter từ HTML doc
// Cấu trúc: <a href="/truyen/{slug}/chuong-N">...<p class="line-clamp-2...">Tiêu đề</p>...</a>
// Dùng :has(p) để lọc bỏ các button-link (Đọc từ đầu / Đọc mới nhất) không có <p> bên trong
function extractChaptersFromDoc(slug, doc, list, seen) {
    var anchors = doc.select("a[href*='/truyen/" + slug + "/chuong-']:has(p)");
    for (var i = 0; i < anchors.size(); i++) {
        var a = anchors.get(i);
        var href = a.attr("href") || "";
        href = href.split("#")[0].split("?")[0];
        if (!href || href.indexOf("/chuong-") < 0) continue;
        var chapUrl = normalizeUrl(href);

        // Tiêu đề chương nằm trong thẻ <p> đầu tiên bên trong anchor
        var chapName = "";
        var pEls = a.select("p");
        if (pEls.size() > 0) {
            chapName = normalizeText(pEls.get(0).text());
        }
        if (!chapName) {
            var n = parseChapterNum(chapUrl);
            chapName = n > 0 ? ("Chương " + n) : "Chương";
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

    // HTML scraping: aitruyen.net không có JSON API cho danh sách chương
    // Dùng ?chapterOrder=asc để lấy từ chương 1 trở đi
    var firstUrl = storyUrl + "?chapterOrder=asc";
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

    // Tìm tổng số trang từ pagination links (vd: href="?chapterPage=123&...")
    var maxPage = 1;
    var pageLinks = firstDoc.select("a[href*='chapterPage=']");
    for (var p = 0; p < pageLinks.size(); p++) {
        var href2 = pageLinks.get(p).attr("href") || "";
        var m2 = href2.match(/chapterPage=(\d+)/i);
        if (!m2) continue;
        var n2 = parseInt(m2[1], 10);
        if (n2 > maxPage) maxPage = n2;
    }

    // Fallback: tìm "Trang N/M" trong text trang
    if (maxPage <= 1) {
        var docText = firstDoc.text() || "";
        var trangMatch = docText.match(/[Tt]rang\s*\d+\s*\/\s*(\d+)/);
        if (trangMatch) maxPage = parseInt(trangMatch[1], 10) || 1;
    }

    // Giới hạn 15 trang (360 chương) để tránh timeout
    if (maxPage > 15) maxPage = 15;

    // Fetch các trang tiếp theo
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
        // Dừng sớm nếu không còn chương mới
        if (result.length === before && pg > 2) break;
    }

    // Sort theo số chương tăng dần
    result.sort(function(a, b) {
        return parseChapterNum(a.url) - parseChapterNum(b.url);
    });

    return Response.success(result);
}