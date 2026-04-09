var HOST = "https://khotruyenchu.click";

function normalizeHost(url) {
    if (!url) return url;
    return url.replace(/https?:\/\/(www\.)?khotruyenchu\.[^/]+/i, HOST);
}

function stripHtml(s) {
    return (s || "").replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ").trim();
}

function cleanHtml(html) {
    if (!html) return "";
    // Loại bỏ cảnh báo sao chép
    html = html.replace(/Cảnh\s*báo[^<]{0,120}khotruyenchu\.[^<"']{1,30}/gi, "");
    html = html.replace(/Đọc\s*bản\s*dịch[^<]{0,120}khotruyenchu\.[^<"']{1,30}/gi, "");

    // Loại bỏ điều hướng
    html = html.replace(/<a[^>]*>\s*[≣\s]*Mục\s*lục\s*<\/a>/gi, "");
    html = html.replace(/<a[^>]*>\s*[«»<>\-\s]*\s*Chương\s*(?:trước|sau)\s*[«»<>\-\s]*\s*<\/a>/gi, "");
    html = html.replace(/Cỡ\s*chữ\s*:\s*A-\s*A\+/gi, "");
    html = html.replace(/[◑○●◉◦•·▪‣o]\s*Giao\s*diện/gi, "");
    html = html.replace(/[«»<>\-\s]*Chương\s*(?:trước|sau)[«»<>\-\s]*/gi, "");
    html = html.replace(/<(?:p|li|a|span|div)[^>]*>\s*[◑○●◉◦•·▪‣\*&nbsp;\s-]*\s*Giao\s*diện\s*<\/(?:p|li|a|span|div)>/gi, "");
    html = html.replace(/^[\t \u00A0]*[◑○●◉◦•·▪‣\*\-]*[\t \u00A0]*Giao\s*diện\s*$/gim, "");

    // Loại bỏ subscribe/login/comment/ads
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|subscribe|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    html = html.replace(/Copyright[\s\S]*$/i, "");

    // Xóa script/style còn sót
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

    return html;
}

function execute(url) {
    url = normalizeHost(url);

    // === Thử lấy nội dung qua WP REST API (nhanh hơn load cả trang HTML) ===
    // Trích slug chương từ URL
    var slug = "";
    var slugMatch = url.match(/\/([^/?#]+)\/?$/);
    if (slugMatch) slug = slugMatch[1];

    if (slug && slug !== "truyen") {
        var apiUrl = HOST + "/wp-json/wp/v2/posts?slug=" + encodeURIComponent(slug)
            + "&_fields=id,content";
        var apiResp = fetch(apiUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": HOST + "/"
            }
        });

        if (apiResp.ok) {
            try {
                var posts = apiResp.json();
                if (posts && posts.length > 0 && posts[0].content && posts[0].content.rendered) {
                    var html = posts[0].content.rendered;
                    html = cleanHtml(html);
                    if (html && stripHtml(html).length > 50) {
                        return Response.success(html);
                    }
                }
            } catch (e) { /* fall through */ }
        }
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
    var html = "";

    // Ưu tiên ghép từ các đoạn văn para
    var paragraphs = doc.select(".entry-content p, article .entry-content p, .post-content p, article p");
    var parts = [];
    for (var i = 0; i < paragraphs.size(); i++) {
        var p = paragraphs.get(i);
        var text = (p.text() || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (/^(?:≣\s*)?mục\s*lục$/i.test(text)) continue;
        if (/^[«»<>\-\s]*chương\s*(?:trước|sau)/i.test(text)) continue;
        if (/^cỡ\s*chữ\s*:?$/i.test(text)) continue;
        if (/^a[+-]$/i.test(text)) continue;
        if (/^[◑○●◉◦•·▪‣o\s\-]*giao\s*diện\s*$/i.test(text)) continue;
        if (/^(subscribe|login)$/i.test(text)) continue;
        parts.push("<p>" + p.html() + "</p>");
    }

    if (parts.length >= 5) {
        html = parts.join("\n");
    } else {
        var content = doc.select(".entry-content, article .entry-content, .post-content, .content-inner").first();
        html = content ? content.html() : doc.html();
    }

    html = cleanHtml(html);

    return Response.success(html);
}
