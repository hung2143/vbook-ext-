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

function extractChaptersFromDoc(slug, doc, list, seen) {
    // Lấy tất cả link /truyen/slug/chuong-N
    var anchors = doc.select("a[href*='/truyen/" + slug + "/chuong-']");
    for (var i = 0; i < anchors.size(); i++) {
        var a = anchors.get(i);
        var href = a.attr("href") || "";
        // Xóa fragment (#...) và query params (???param=...)
        href = href.split("#")[0].split("?")[0];
        if (!href || href.indexOf("/chuong-") < 0) continue;
        var chapUrl = normalizeUrl(href);

        // Lấy tên chương: lấy từ text của thẻ a, bỏ qua các text không phải tên chương
        var rawText = normalizeText(a.text());
        var chapName = "";

        // Thử lấy "Chương N: Tên" từ text
        var chapMatch = rawText.match(/(Chương\s*\d+[^•\n\r]{0,100})/i);
        if (chapMatch) {
            chapName = normalizeText(chapMatch[1]);
            // Cắt bỏ phần sau bullet hoặc ngày tháng dài
            chapName = chapName.replace(/\s*•\s*.*$/, "").trim();
        }
        if (!chapName) {
            var n = parseChapterNum(chapUrl);
            chapName = n > 0 ? ("Chương " + n) : "Chương";
        }
        pushChapter(list, seen, chapUrl, chapName);
    }
}

function fetchPage(storyUrl, pageNum, slug, list, seen) {
    var pageUrl = storyUrl + "?chapterPage=" + pageNum + "&chapterOrder=asc";
    var resp = fetch(pageUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": storyUrl
        }
    });
    if (!resp.ok) return false;

    var doc = resp.html("utf-8");
    if (!doc) return false;

    var before = list.length;
    extractChaptersFromDoc(slug, doc, list, seen);
    return list.length > before; // true nếu thêm được chương mới
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var result = [];
    var seen = {};

    // Fetch trang đầu (chapterOrder=asc để lấy từ chương 1)
    var firstUrl = storyUrl + "?chapterPage=1&chapterOrder=asc";
    var firstResp = fetch(firstUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!firstResp.ok) return Response.success([]);

    var firstDoc = firstResp.html("utf-8");
    if (!firstDoc) return Response.success([]);

    extractChaptersFromDoc(slug, firstDoc, result, seen);

    // Lấy tổng số trang từ pagination
    // Trên aitruyen.net: link dạng ?chapterPage=123&chapterOrder=asc&communityTab=reviews#danh-sach-chuong
    var maxPage = 1;

    // Tìm số trang lớn nhất trong pagination
    var pageLinks = firstDoc.select("a[href*='chapterPage=']");
    for (var p = 0; p < pageLinks.size(); p++) {
        var href = pageLinks.get(p).attr("href") || "";
        var m = href.match(/chapterPage=(\d+)/i);
        if (!m) continue;
        var n = parseInt(m[1], 10);
        if (n > maxPage) maxPage = n;
    }

    // Nếu không tìm được từ links, thử tính từ text "Đang xem X - Y trong tổng Z.NK chương"
    if (maxPage <= 1 && result.length > 0) {
        var pageText = firstDoc.text() || "";
        var totalMatch = pageText.match(/trong\s+tổng\s*([\d.,]+K?)\s*chương/i);
        if (totalMatch) {
            var totalStr = totalMatch[1].replace(/\./g, "").replace(",", ".");
            var total = 0;
            if (totalStr.indexOf("K") >= 0) total = Math.ceil(parseFloat(totalStr.replace("K", "")) * 1000);
            else total = parseInt(totalStr, 10);
            if (total > 0 && result.length > 0) {
                maxPage = Math.ceil(total / result.length);
            }
        }
    }

    // Giới hạn an toàn (không fetch quá nhiều trang)
    if (maxPage > 300) maxPage = 300;

    // Fetch các trang còn lại
    for (var pg = 2; pg <= maxPage; pg++) {
        var added = fetchPage(storyUrl, pg, slug, result, seen);
        if (!added && pg > 2) {
            // Trang không thêm được chương mới → dừng sớm
            break;
        }
    }

    // Sort theo số chương
    result.sort(function(a, b) {
        return parseChapterNum(a.url) - parseChapterNum(b.url);
    });

    return Response.success(result);
}
