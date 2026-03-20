function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function safeDecodeSlug(link) {
    try {
        var slug = (link || "").split("/");
        slug = slug[slug.length - 1] || "";
        return decodeURIComponent(slug.replace(/-/g, " "));
    } catch (e) {
        return (link || "").replace(/-/g, " ");
    }
}

function execute(key, page) {
    try {
        if (!page) page = "1";
        var pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        var searchUrl = "https://trangtruyen.site/tim-kiem?word=" + encodeURIComponent(key) + "&page=" + pageNum;
        var response = fetch(searchUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) return Response.success([], null);

        var doc = response.html("utf-8");
        var data = [];
        var seen = {};

        var items = doc.select("a[href*='/stories/']");
        for (var i = 0; i < items.size(); i++) {
            var e = items.get(i);
            var link = normalizeUrl(e.attr("href"));
            if (!link || seen[link]) continue;
            if (link.indexOf("/stories/") < 0) continue;

            seen[link] = true;
            var name = (e.text() || e.attr("title") || "").replace(/\s+/g, " ").trim();
            if (!name) name = safeDecodeSlug(link);

            data.push({
                name: name,
                link: link,
                cover: "",
                description: "",
                host: "https://trangtruyen.site"
            });
        }

        if (data.length === 0) {
            var html = doc.html() || "";
            var regex = /(https:\/\/trangtruyen\.site\/stories\/[^"'>\s]+|\/stories\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = normalizeUrl(m[0]);
                if (!link2 || seen[link2]) continue;
                seen[link2] = true;

                data.push({
                    name: safeDecodeSlug(link2),
                    link: link2,
                    cover: "",
                    description: "",
                    host: "https://trangtruyen.site"
                });
            }
        }

        var next = null;
        var htmlLower = (doc.html() || "").toLowerCase();
        if (htmlLower.indexOf("page=" + (pageNum + 1)) !== -1 && data.length > 0) {
            next = (pageNum + 1).toString();
        }

        return Response.success(data, next);
    } catch (e) {
        return Response.success([], null);
    }
}
