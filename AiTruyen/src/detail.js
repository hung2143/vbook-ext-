// detail.js - Lấy thông tin chi tiết một truyện trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.startsWith("//")) return "https:" + link;
    if (!link.startsWith("http")) return HOST + link;
    return link;
}

function stripHtml(s) {
    return (s || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ").trim();
}

function execute(url) {
    // Trích slug từ URL
    var slugMatch = url.match(/\/truyen\/([^/?#]+)/);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    // === Thử API ===
    var apiUrl = HOST + "/api/stories/" + encodeURIComponent(slug);
    var apiResp = fetch(apiUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/",
            "accept": "application/json"
        }
    });

    if (apiResp.ok) {
        try {
            var json = apiResp.json();
            var story = json.data || json.story || json;
            if (story && (story.title || story.name)) {
                var cover = story.cover || story.thumbnail || story.image || "";
                if (cover && !cover.startsWith("http")) cover = normalizeUrl(cover);

                var author = story.author || (story.authors && story.authors[0] && story.authors[0].name) || "";
                var status = story.status || story.state || "";
                var isOngoing = !/ho[àa]n|complete|finished/i.test(status);

                var genres = "";
                if (story.genres && story.genres.length > 0) {
                    genres = story.genres.map(function(g) { return g.name || g; }).join(", ");
                } else if (story.categories && story.categories.length > 0) {
                    genres = story.categories.map(function(g) { return g.name || g; }).join(", ");
                }

                var infoLines = [];
                if (author) infoLines.push("Tác giả: " + author);
                if (genres) infoLines.push("Thể loại: " + genres);
                if (status) infoLines.push("Trạng thái: " + status);

                return Response.success({
                    name: story.title || story.name,
                    cover: cover,
                    author: author,
                    description: story.description || story.summary || story.title || story.name,
                    detail: infoLines.join("<br>"),
                    ongoing: isOngoing,
                    host: HOST
                });
            }
        } catch (e) { /* thử HTML scraping */ }
    }

    // === Fallback: HTML scraping ===
    var response = fetch(HOST + "/truyen/" + slug, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var pageHtml = doc.html() || "";

    // Tiêu đề từ h1
    var title = "";
    var h1 = doc.select("h1").first();
    if (h1) title = h1.text().trim();
    if (!title) title = doc.select("title").text().replace(/[\s\-|]*AI Truy[eệ]n.*/i, "").trim();
    if (!title) title = decodeURIComponent(slug.replace(/-/g, " "));

    // Trạng thái: tìm "Còn tiếp" hoặc "Hoàn thành" gần h1
    var statusText = "";
    var statusMatch = pageHtml.match(/(Còn\s*tiếp|Hoàn\s*thành)/i);
    if (statusMatch) statusText = statusMatch[1].trim();

    // Tác giả: tìm span/div gần h1 chứa tên tác giả
    // Cấu trúc đã biết: span class="...text-[var(--color-ink-soft)]" chứa tên tác giả phía trên h1
    var author = "";
    // Tìm trong vùng xung quanh h1 - lấy thẻ span/p nhỏ gần h1
    var metaOgAuthor = doc.select("meta[name='author']").attr("content");
    if (metaOgAuthor) {
        author = metaOgAuthor.trim();
    }
    if (!author) {
        // Tìm trong JSON-LD hoặc structured data
        var ldMatch = pageHtml.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
        if (ldMatch) author = ldMatch[1];
    }
    if (!author) {
        // Tác giả thường nằm trong span trước h1, có class chứa "ink-soft"
        var spans = doc.select("span");
        for (var si = 0; si < Math.min(spans.size(), 20); si++) {
            var sp = spans.get(si);
            var spClass = sp.attr("class") || "";
            if (spClass.indexOf("ink-soft") >= 0 || spClass.indexOf("text-xs") >= 0) {
                var spText = sp.text().trim();
                // Author thường ngắn & không phải là thể loại
                if (spText && spText.length > 1 && spText.length < 60 && !/^(Còn|Hoàn|Chương|Chapter)/i.test(spText)) {
                    author = spText;
                    break;
                }
            }
        }
    }

    // Cover từ meta og:image
    var cover = "";
    var ogImage = doc.select("meta[property='og:image']").attr("content");
    if (ogImage) cover = normalizeUrl(ogImage);
    if (!cover) {
        var img = doc.select("img[alt]").first();
        if (img) {
            cover = img.attr("src") || img.attr("data-src") || "";
            // Giải mã Next.js image URL
            if (cover.indexOf("/_next/image") >= 0) {
                var urlParam = cover.match(/url=([^&]+)/);
                if (urlParam) cover = decodeURIComponent(urlParam[1]);
            }
            if (cover) cover = normalizeUrl(cover);
        }
    }

    // Mô tả từ og:description hoặc meta description
    var desc = "";
    desc = doc.select("meta[property='og:description']").attr("content");
    if (!desc) desc = doc.select("meta[name='description']").attr("content") || "";
    if (!desc) {
        // Tìm div chứa description gần h1 - class "line-clamp" thường chứa mô tả
        var descEl = doc.select("[class*='line-clamp']").first();
        if (descEl) desc = descEl.text();
    }
    desc = (desc || "").replace(/\s+/g, " ").trim();
    if (!desc) desc = title;

    // Thể loại từ structured data hoặc link
    var genres = "";
    var genreLinks = doc.select("a[href*='/the-loai/'], a[href*='/genre/']");
    if (genreLinks.size() > 0) {
        var genreArr = [];
        for (var gi = 0; gi < genreLinks.size(); gi++) {
            genreArr.push(genreLinks.get(gi).text().trim());
        }
        if (genreArr.length > 0) genres = genreArr.join(", ");
    }

    var infoLines = [];
    if (author) infoLines.push("Tác giả: " + author);
    if (genres) infoLines.push("Thể loại: " + genres);
    if (statusText) infoLines.push("Trạng thái: " + statusText);

    var isOngoing = statusText ? !/ho[àa]n/i.test(statusText) : true;

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc,
        detail: infoLines.join("<br>"),
        ongoing: isOngoing,
        host: HOST
    });
}
