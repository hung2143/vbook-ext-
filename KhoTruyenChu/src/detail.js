var HOST = "https://khotruyenchu.click";

function normalizeHost(url) {
    if (!url) return url;
    return url.replace(/https?:\/\/(www\.)?khotruyenchu\.[^/]+/i, HOST);
}

function normalizeUrl(link) {
    if (!link) return "";
    if (link.startsWith("//")) return "https:" + link;
    if (!link.startsWith("http")) return HOST + link;
    return link;
}

function stripHtml(s) {
    return (s || "").replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ").trim();
}

function execute(url) {
    url = normalizeHost(url);

    // Trích slug từ URL: /truyen/slug-truyen/
    var slugMatch = url.match(/\/truyen\/([^/?#]+)/);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    // === Thử lấy dữ liệu qua WP REST API (bo_truyen taxonomy) ===
    var apiUrl = HOST + "/wp-json/wp/v2/bo_truyen?slug=" + encodeURIComponent(slug);
    var apiResp = fetch(apiUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (apiResp.ok) {
        try {
            var terms = apiResp.json();
            if (terms && terms.length > 0) {
                var term = terms[0];
                var title = stripHtml(term.name || slug);
                var desc = stripHtml(term.description || "");

                // Lấy cover từ yoast_head_json
                var cover = "";
                try {
                    if (term.yoast_head_json && term.yoast_head_json.og_image && term.yoast_head_json.og_image[0]) {
                        cover = term.yoast_head_json.og_image[0].url || "";
                    }
                } catch (ignore) {}
                if (!cover && term.yoast_head) {
                    var ogMatch = term.yoast_head.match(/property="og:image"\s+content="([^"]+)"/);
                    if (ogMatch) cover = ogMatch[1];
                }

                // Trích author, category, status từ description
                var author = "";
                var category = "";
                var status = "";

                // Description thường chứa: "Tác giả: X Thể loại: Y Tình trạng: Z"
                var authorMatch = desc.match(/Tác\s*giả\s*:\s*([^]*?)(?=Thể\s*loại\s*:|Tình\s*trạng\s*:|$)/i);
                if (authorMatch) author = authorMatch[1].trim();

                var catMatch = desc.match(/Thể\s*loại\s*:\s*([^]*?)(?=Tình\s*trạng\s*:|Tác\s*giả\s*:|$)/i);
                if (catMatch) category = catMatch[1].trim();

                var statusMatch = desc.match(/Tình\s*trạng\s*:\s*([^\n\r]+)/i);
                if (statusMatch) status = statusMatch[1].trim();

                // Lọc description: bỏ phần metadata
                var cleanDesc = desc
                    .replace(/Tác\s*giả\s*:[^]*?(?=Thể\s*loại\s*:|Tình\s*trạng\s*:|$)/i, "")
                    .replace(/Thể\s*loại\s*:[^]*?(?=Tình\s*trạng\s*:|Tác\s*giả\s*:|$)/i, "")
                    .replace(/Tình\s*trạng\s*:[^\n\r]*/i, "")
                    .replace(/Đọc\s*Từ\s*Đầu[\s\S]*$/i, "")
                    .replace(/Chương\s*Mới\s*Nhất[\s\S]*$/i, "")
                    .replace(/\s+/g, " ").trim();

                if (!cleanDesc) cleanDesc = desc;

                var infoLines = [];
                if (author) infoLines.push("Tác giả: " + author);
                if (category) infoLines.push("Thể loại: " + category);
                if (status) infoLines.push("Trạng thái: " + status);
                if (term.count) infoLines.push("Số chương: " + term.count);
                var info = infoLines.join("<br>");

                return Response.success({
                    name: title,
                    cover: cover,
                    author: author,
                    description: cleanDesc || title,
                    detail: info,
                    ongoing: status ? !/hoàn|hoan\s*thanh|đã\s*xong|da\s*xong|full/i.test(status) : true,
                    host: HOST
                });
            }
        } catch (e) { /* fall through to HTML */ }
    }

    // === Fallback: HTML scraping ===
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var pageHtml = doc.html() || "";

    var name = doc.select("h1, h2").first();
    var title2 = name ? name.text() : doc.select("title").text();
    title2 = (title2 || "").replace(/^\s*bộ\s*truyện\s*/i, "").replace(/\s+/g, " ").trim();

    // Cover
    var cover2 = "";
    var metaOg = doc.select("meta[property='og:image']").attr("content");
    if (metaOg) cover2 = normalizeUrl(metaOg);
    if (!cover2) {
        var firstImg = doc.select("img.wp-post-image, .post-thumbnail img, .entry-content img").first();
        if (firstImg) {
            cover2 = normalizeUrl(firstImg.attr("data-src") || firstImg.attr("src") || "");
        }
    }

    var fullText = doc.text() || "";

    function extractField(label) {
        var re = new RegExp(label + "\\s*:\\s*(?:<[^>]+>\\s*)*([^<\\n\\r]+)", "i");
        var m2 = pageHtml.match(re);
        if (m2) return m2[1].replace(/\s+/g, " ").trim();
        var re2 = new RegExp(label + "\\s*:\\s*([^\\n\\r]+)", "i");
        var m3 = fullText.match(re2);
        if (!m3) return "";
        return m3[1].replace(/(Tác\s*giả\s*:|Thể\s*loại\s*:|Tình\s*trạng\s*:).*/i, "").replace(/\s+/g, " ").trim();
    }

    var author2 = extractField("Tác\\s*giả");
    var category2 = extractField("Thể\\s*loại");
    var status2 = extractField("Tình\\s*trạng");

    var desc2 = doc.select("meta[name='description']").attr("content") || title2;
    desc2 = (desc2 || "").replace(/\s+/g, " ").trim();

    var infoLines2 = [];
    if (author2) infoLines2.push("Tác giả: " + author2);
    if (category2) infoLines2.push("Thể loại: " + category2);
    if (status2) infoLines2.push("Trạng thái: " + status2);
    var info2 = infoLines2.join("<br>");

    return Response.success({
        name: title2,
        cover: cover2,
        author: author2,
        description: desc2 || title2,
        detail: info2,
        ongoing: status2 ? !/hoàn|hoan\s*thanh|đã\s*xong|da\s*xong|full/i.test(status2) : true,
        host: HOST
    });
}
