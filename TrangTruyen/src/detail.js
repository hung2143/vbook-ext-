function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function cleanText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function extractSlug(url) {
    var m = (url || "").match(/\/stories\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

function execute(url) {
    try {
        var slug = extractSlug(url);
        if (slug) {
            var apiResponse = fetch("https://trangtruyen.site/api/stories/" + slug, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": "https://trangtruyen.site/"
                }
            });

            if (apiResponse.ok) {
                var apiJson = apiResponse.json();
                var story = apiJson ? apiJson.story : null;
                if (story) {
                    var category = "";
                    if (story.categories && story.categories.length) {
                        category = story.categories.join(", ");
                    }

                    var status = story.status || "";
                    var detailLines = [];
                    if (story.author) detailLines.push("Tác giả: " + story.author);
                    if (category) detailLines.push("Thể loại: " + category);
                    if (status) detailLines.push("Trạng thái: " + status);

                    return Response.success({
                        name: story.title || "Không rõ tiêu đề",
                        cover: normalizeUrl(story.coverImage || ""),
                        author: story.author || "",
                        description: story.description || (story.title || ""),
                        detail: detailLines.join("<br>"),
                        ongoing: status ? !/hoàn|complete|completed/i.test(status) : true,
                        host: "https://trangtruyen.site"
                    });
                }
            }
        }

        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) return null;

        var doc = response.html("utf-8");

        var title = "";
        var titleEl = doc.select("h1, h2").first();
        if (titleEl) title = cleanText(titleEl.text());
        if (!title) title = cleanText(doc.select("meta[property='og:title']").attr("content"));
        if (!title) title = cleanText(doc.select("title").text());

        var cover = "";
        cover = normalizeUrl(doc.select("meta[property='og:image']").attr("content"));
        if (!cover) {
            var img = doc.select("img").first();
            if (img) cover = normalizeUrl(img.attr("data-src") || img.attr("src") || "");
        }

        var author = "";
        var status = "";
        var category = "";

        var plain = doc.text() || "";
        var mAuthor = plain.match(/Tác\s*giả\s*:\s*([^\n\r]+)/i);
        if (mAuthor) author = cleanText(mAuthor[1]);
        var mStatus = plain.match(/Trạng\s*thái\s*:\s*([^\n\r]+)/i);
        if (mStatus) status = cleanText(mStatus[1]);
        var mCategory = plain.match(/Thể\s*loại\s*:\s*([^\n\r]+)/i);
        if (mCategory) category = cleanText(mCategory[1]);

        var desc = cleanText(doc.select("meta[name='description']").attr("content"));
        if (!desc) {
            var p = doc.select("main p, article p, p").first();
            if (p) desc = cleanText(p.text());
        }
        if (!desc) desc = title;

        var detailLines = [];
        if (author) detailLines.push("Tác giả: " + author);
        if (category) detailLines.push("Thể loại: " + category);
        if (status) detailLines.push("Trạng thái: " + status);

        return Response.success({
            name: title || "Không rõ tiêu đề",
            cover: cover,
            author: author,
            description: desc,
            detail: detailLines.join("<br>"),
            ongoing: status ? !/hoàn|xong/i.test(status) : true,
            host: "https://trangtruyen.site"
        });
    } catch (e) {
        return null;
    }
}
