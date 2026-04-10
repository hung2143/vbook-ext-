// detail.js - Lấy thông tin chi tiết truyện trên AiTruyen
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return HOST + link;
    return link;
}

function decodeNextImage(src) {
    if (!src) return "";
    if (src.indexOf("/_next/image") >= 0) {
        var m = src.match(/url=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
    }
    return src;
}

function normalizeCover(src) {
    return normalizeUrl(decodeNextImage(src || ""));
}

function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function decodeEscapedText(s) {
    if (!s) return "";
    var out = s;
    out = out.replace(/\\u0026/g, "&");
    out = out.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">");
    out = out.replace(/\\u002f/g, "/");
    out = out.replace(/\\\//g, "/");
    out = out.replace(/\\n/g, "\n").replace(/\\r/g, " ").replace(/\\t/g, " ");
    out = out.replace(/\\"/g, '"');
    return normalizeText(out);
}

function pickFromJsonBlock(block, keys) {
    if (!block) return "";
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var re = new RegExp('"' + key + '"\\s*:\\s*"([^\\"]{1,1200})"', "i");
        var m = block.match(re);
        if (m && m[1]) return decodeEscapedText(m[1]);
    }
    return "";
}

function pickListFromJsonBlock(block, keys) {
    if (!block) return "";
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var re = new RegExp('"' + key + '"\\s*:\\s*\\[([\\s\\S]{1,800})\\]', "i");
        var m = block.match(re);
        if (!m || !m[1]) continue;

        var listRaw = m[1];
        var out = [];
        var sm;
        var strRe = /"([^"\\]{1,100})"/g;
        while ((sm = strRe.exec(listRaw)) !== null) {
            var item = decodeEscapedText(sm[1]);
            if (item && out.indexOf(item) < 0) out.push(item);
            if (out.length >= 8) break;
        }
        if (out.length > 0) return out.join(", ");
    }
    return "";
}

function extractIntroFromText(pageText) {
    if (!pageText) return "";

    var txt = normalizeText(pageText);
    var introMatch = txt.match(/(?:GIỚI THIỆU|Giới thiệu)\s*(?:Tổng quan nhanh\s*)?([\s\S]*?)(?:DANH SÁCH CHƯƠNG|Mục lục chương|Đánh giá và thảo luận|Có thể bạn cũng thích|CỘNG ĐỒNG)/i);
    if (introMatch && introMatch[1]) {
        var intro = normalizeText(introMatch[1]);
        if (intro && intro.length > 30) return intro;
    }
    return "";
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var response = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    if (!doc) return null;

    var pageHtml = doc.html() || "";
    var pageText = doc.text() || "";

    var title = "";
    var cover = "";
    var author = "";
    var genres = "";
    var statusText = "";
    var desc = "";

    var aroundSlug = "";
    var slugIdx = pageHtml.indexOf('"slug":"' + slug + '"');
    if (slugIdx >= 0) {
        var start = Math.max(0, slugIdx - 1800);
        var end = Math.min(pageHtml.length, slugIdx + 5000);
        aroundSlug = pageHtml.substring(start, end);
    }

    title = pickFromJsonBlock(aroundSlug, ["title", "name"]);
    cover = normalizeCover(pickFromJsonBlock(aroundSlug, ["cover", "coverImage", "coverUrl", "thumbnail", "thumbnailUrl", "image", "poster"]));
    author = pickFromJsonBlock(aroundSlug, ["author", "authorName", "translator"]);
    statusText = pickFromJsonBlock(aroundSlug, ["status", "state"]);
    desc = pickFromJsonBlock(aroundSlug, ["description", "summary", "synopsis", "excerpt"]);
    genres = pickListFromJsonBlock(aroundSlug, ["categories", "genres", "tags"]);

    if (!title) {
        var h1 = doc.select("h1").first();
        if (h1) title = normalizeText(h1.text());
    }
    if (!title) title = normalizeText(doc.select("meta[property='og:title']").attr("content"));
    if (!title) title = normalizeText(doc.select("title").text().replace(/[\s\-|]*AI Truy[eệ]n.*/i, ""));
    if (!title) title = decodeURIComponent(slug.replace(/-/g, " "));

    if (!cover) cover = normalizeCover(doc.select("meta[property='og:image']").attr("content"));
    if (!cover) {
        var imgs = doc.select("img");
        for (var i = 0; i < Math.min(imgs.size(), 30); i++) {
            var src = imgs.get(i).attr("src") || imgs.get(i).attr("data-src") || "";
            if (!src) continue;
            src = normalizeCover(src);
            if (!src) continue;
            if (src.indexOf("/media/covers/") >= 0) {
                cover = src;
                break;
            }
            if (src.indexOf("logo") >= 0 || src.indexOf("icon") >= 0 || src.indexOf("avatar") >= 0) continue;
            if (!cover) cover = src;
        }
    }

    if (!author || !genres) {
        var lineMatch = pageText.match(/\n?([^\n\r]{2,80})\s*•\s*([^\n\r]{2,120})/);
        if (lineMatch) {
            if (!author) author = normalizeText(lineMatch[1]);
            if (!genres) genres = normalizeText(lineMatch[2]);
        }
    }

    if (!statusText) {
        var stMatch = pageText.match(/\b(Còn\s*tiếp|Hoàn\s*thành|Đang\s*ra)\b/i);
        if (stMatch) statusText = normalizeText(stMatch[1]);
    }

    if (!genres) {
        var chips = doc.select("a[href*='/the-loai/'], a[href*='/genre/'], a[href*='/tag/']");
        if (chips.size() > 0) {
            var arr = [];
            for (var c = 0; c < chips.size(); c++) {
                var t = normalizeText(chips.get(c).text());
                if (t && arr.indexOf(t) < 0) arr.push(t);
            }
            genres = arr.join(", ");
        }
    }

    if (!desc) desc = extractIntroFromText(pageText);
    if (!desc) desc = normalizeText(doc.select("meta[property='og:description']").attr("content"));
    if (!desc) desc = normalizeText(doc.select("meta[name='description']").attr("content"));
    if (!desc || /^Nền tảng truyện thông minh/i.test(desc)) {
        var ps = doc.select("p");
        for (var p = 0; p < ps.size(); p++) {
            var pt = normalizeText(ps.get(p).text());
            if (!pt || pt.length < 40) continue;
            if (/^(Nền tảng truyện thông minh|Lối vào chính|Yêu cầu gỡ truyện)/i.test(pt)) continue;
            desc = pt;
            break;
        }
    }
    if (!desc) desc = title;

    var infoLines = [];
    if (author) infoLines.push("Tác giả: " + author);
    if (genres) infoLines.push("Thể loại: " + genres);
    if (statusText) infoLines.push("Trạng thái: " + statusText);

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc,
        detail: infoLines.join("<br>"),
        ongoing: statusText ? !/ho[àa]n|complete|completed|finished/i.test(statusText) : true,
        host: HOST
    });
}
