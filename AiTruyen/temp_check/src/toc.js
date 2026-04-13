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

/**
 * Tách chapter từ script __next_f (RSC data) nhúng trong HTML.
 * aitruyen.net là Next.js App Router — dữ liệu phân trang chương được
 * nhúng dưới dạng JSON bên trong các thẻ <script> (self.__next_f.push(...)).
 * Phân tích bằng regex nhanh hơn nhiều so với JSoup DOM.
 * Trả về { found: số chương thêm được, totalPages: tổng số trang }
 */
function extractChaptersFromRSC(slug, doc, list, seen) {
    var scripts = doc.select("script:not([src])");
    var totalPages = 1;
    var found = 0;

    for (var s = 0; s < scripts.size(); s++) {
        var txt = scripts.get(s).html();
        if (!txt || txt.indexOf("ordinal") < 0 || txt.indexOf("chapterNumberRaw") < 0) continue;

        // RSC data tồn tại ở hai dạng trong script text:
        //   (a) JSON đã decode: "ordinal":N,"title":"..."
        //   (b) JSON lồng trong JS string: \"ordinal\":N,\"title\":\"...\"
        // Thử cả hai pattern.

        // Pattern (a) — quotes không bị escape
        var reA = /"ordinal":(\d+),"chapterNumberRaw":"[^"]*","title":"([^"]*)"/g;
        var m;
        while ((m = reA.exec(txt)) !== null) {
            var ord = parseInt(m[1], 10);
            var chapUrl = HOST + "/truyen/" + slug + "/chuong-" + ord;
            var title = m[2].trim() || ("Chương " + ord);
            pushChapter(list, seen, chapUrl, title);
            found++;
        }

        // Pattern (b) — quotes bị escape bằng backslash trong JS string
        var reB = /\\"ordinal\\":(\d+),\\"chapterNumberRaw\\":\\"[^\\]*\\",\\"title\\":\\"([^\\"]*)\\"/g;
        while ((m = reB.exec(txt)) !== null) {
            var ord2 = parseInt(m[1], 10);
            var chapUrl2 = HOST + "/truyen/" + slug + "/chuong-" + ord2;
            var title2 = m[2].trim() || ("Chương " + ord2);
            pushChapter(list, seen, chapUrl2, title2);
            found++;
        }

        // Tìm tổng số trang từ field "totalPages" trong pagination
        var tpA = txt.match(/"totalPages":(\d+)/);
        if (tpA) {
            var tp = parseInt(tpA[1], 10);
            if (tp > totalPages) totalPages = tp;
        }
        var tpB = txt.match(/\\"totalPages\\":(\d+)/);
        if (tpB) {
            var tp2 = parseInt(tpB[1], 10);
            if (tp2 > totalPages) totalPages = tp2;
        }
    }

    return { found: found, totalPages: totalPages };
}

// Fallback: trích chapter từ DOM bằng JSoup selector
function extractChaptersFromDoc(slug, doc, list, seen) {
    var anchors = doc.select("a[href*='/truyen/" + slug + "/chuong-']:has(p)");
    for (var i = 0; i < anchors.size(); i++) {
        var a = anchors.get(i);
        var href = a.attr("href") || "";
        href = href.split("#")[0].split("?")[0];
        if (!href || href.indexOf("/chuong-") < 0) continue;
        var chapUrl = normalizeUrl(href);
        var chapName = "";
        var pEls = a.select("p");
        if (pEls.size() > 0) chapName = normalizeText(pEls.get(0).text());
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

    // Fetch trang đầu với sắp xếp tăng dần
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

    // Ưu tiên RSC extraction (nhanh hơn DOM parsing)
    var rscInfo = extractChaptersFromRSC(slug, firstDoc, result, seen);
    var maxPage = rscInfo.totalPages;

    // Fallback sang DOM nếu RSC không cho kết quả
    if (result.length === 0) {
        extractChaptersFromDoc(slug, firstDoc, result, seen);

        // Tìm tổng số trang từ pagination links trong DOM
        if (maxPage <= 1) {
            var pageLinks = firstDoc.select("a[href*='chapterPage=']");
            for (var p = 0; p < pageLinks.size(); p++) {
                var href2 = pageLinks.get(p).attr("href") || "";
                var m2 = href2.match(/chapterPage=(\d+)/i);
                if (!m2) continue;
                var n2 = parseInt(m2[1], 10);
                if (n2 > maxPage) maxPage = n2;
            }
        }

        // Fallback: tìm "Trang N/M" trong text trang
        if (maxPage <= 1) {
            var docText = firstDoc.text() || "";
            var trangMatch = docText.match(/[Tt]rang\s*\d+\s*\/\s*(\d+)/);
            if (trangMatch) maxPage = parseInt(trangMatch[1], 10) || 1;
        }
    }

    // Giới hạn 20 trang (≈ 480 chương) để tránh timeout
    if (maxPage > 20) maxPage = 20;

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
        // Dùng RSC trước, fallback DOM
        var pgRsc = extractChaptersFromRSC(slug, pgDoc, result, seen);
        if (pgRsc.found === 0) extractChaptersFromDoc(slug, pgDoc, result, seen);

        // Dừng sớm nếu không còn chương mới
        if (result.length === before && pg > 2) break;
    }

    // Sort theo số chương tăng dần
    result.sort(function(a, b) {
        return parseChapterNum(a.url) - parseChapterNum(b.url);
    });

    return Response.success(result);
}