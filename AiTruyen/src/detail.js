// detail.js - Lấy thông tin chi tiết truyện trên AiTruyen
// Ưu tiên DOM thật của trang chi tiết để lấy đủ tác giả, thể loại, stats và phần giới thiệu đầy đủ.
// OG meta tags chỉ dùng fallback cho cover/mô tả ngắn nếu DOM thiếu.
var HOST = "https://aitruyen.net";

function normalizeCover(src) {
    if (!src) return "";
    // Xử lý Next.js Image Optimization URLs
    if (src.indexOf("/_next/image") >= 0) {
        var m = src.match(/url=([^&]+)/);
        if (m) src = decodeURIComponent(m[1]);
    }
    if (src.indexOf("//") === 0) return "https:" + src;
    if (src.indexOf("http") !== 0) return HOST + src;
    return src;
}

function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function cleanIntroHtml(html) {
    if (!html) return "";
    return (html + "")
        .replace(/<\/p>\s*<p>/gi, "<br><br>")
        .replace(/^\s*<p>/i, "")
        .replace(/<\/p>\s*$/i, "")
        .trim();
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var response = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    if (!doc) return null;

    var title = normalizeText(doc.select("h1").first() ? doc.select("h1").first().text() : "");
    if (!title) {
        title = normalizeText(doc.select("meta[property='og:title']").attr("content"))
            .replace(/\s*\|\s*AI Truy[eệ]n\s*$/i, "")
            .replace(/\s*-\s*[^\-]{2,100}\s*$/i, "")
            .trim();
    }
    if (!title) title = slug.replace(/-/g, " ");

    var cover = normalizeCover(doc.select("meta[property='og:image']").attr("content"));
    if (!cover) {
        var heroImg = doc.select("img[alt='" + title.replace(/'/g, "\\'") + "']").first();
        if (!heroImg) heroImg = doc.select("img").first();
        if (heroImg) cover = normalizeCover(heroImg.attr("src") || heroImg.attr("data-src") || "");
    }

    var author = "";
    var authorLinks = doc.select("a[href*='tim-kiem?author='], a[href*='tim-kiem?author%']");
    if (authorLinks.size() > 0) author = normalizeText(authorLinks.first().text());

    var statusText = "";
    var genresArr = [];
    var genreRail = doc.select(".discovery-pill-rail").first();
    if (genreRail) {
        var genreSpans = genreRail.select("span");
        for (var gi = 0; gi < genreSpans.size(); gi++) {
            var genreText = normalizeText(genreSpans.get(gi).text());
            if (genreText && genresArr.indexOf(genreText) < 0) genresArr.push(genreText);
        }
    }

    var spans = doc.select("span");
    var statsArr = [];
    for (var si = 0; si < spans.size(); si++) {
        var text = normalizeText(spans.get(si).text());
        if (!text) continue;

        if (!statusText && /^(Còn tiếp|Hoàn thành|Tạm dừng|Ngưng|Đang ra)$/i.test(text)) {
            statusText = text;
            continue;
        }

        if (/^(\d+(?:[.,]\d+)?|N\/A)\s*điểm$/i.test(text) || /chương$/i.test(text) || /bình luận$/i.test(text) || /lượt xem$/i.test(text)) {
            if (statsArr.indexOf(text) < 0) statsArr.push(text);
            continue;
        }

        if (genresArr.length === 0 && text.length >= 2 && text.length <= 40 && genresArr.indexOf(text) < 0) {
            if (!/^(Đọc từ đầu|Đã có trong tủ truyện|Mở|AI|cả bộ|chìa|Đọc tiếp|Chương\s+\d+|Tổng quan nhanh|Giới thiệu)$/i.test(text)) {
                if (text !== author && text !== statusText && !/điểm$|chương$|bình luận$|lượt xem$/i.test(text)) {
                    if (genresArr.length < 8) genresArr.push(text);
                }
            }
        }
    }

    var summary = normalizeText(doc.select("p.discovery-supporting-copy").text());
    if (!summary) summary = normalizeText(doc.select("meta[property='og:description']").attr("content"));
    if (!summary) summary = normalizeText(doc.select("meta[name='description']").attr("content"));

    var richContent = doc.select(".rich-content").first();
    var desc = richContent ? cleanIntroHtml(richContent.html()) : summary;
    if (!desc) desc = title;

    var genres = genresArr.join(", ");
    var infoLines = [];
    if (author) infoLines.push(author);
    if (genres) infoLines.push(genres);
    if (statusText) infoLines.push(statusText);
    if (statsArr.length > 0) infoLines.push(statsArr.join(" • "));

    var isOngoing = !statusText || !/ho[àa]n|complete[d]?|finished/i.test(statusText);

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc,
        detail: infoLines.join("\n"),
        ongoing: isOngoing,
        host: HOST
    });
}
