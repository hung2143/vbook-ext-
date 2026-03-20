function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function execute(key, page) {
    try {
        var pageNum = parseInt(page || "1", 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        var searchUrl = "https://trangtruyen.site/api/stories?q=" + encodeURIComponent(key || "") + "&page=" + pageNum;
        var response = fetch(searchUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) return Response.success([], null);

        var json = response.json();
        var items = (json && json.items) ? json.items : [];
        var data = [];

        for (var i = 0; i < items.length; i++) {
            var it = items[i] || {};
            if (!it.slug) continue;
            data.push({
                name: it.title || it.slug,
                link: "https://trangtruyen.site/stories/" + it.slug,
                cover: normalizeUrl(it.coverImage || ""),
                description: it.author ? ("Tác giả: " + it.author) : "",
                host: "https://trangtruyen.site"
            });
        }

        var next = null;
        var p = json ? json.pagination : null;
        if (p && p.page && p.totalPages && p.page < p.totalPages) {
            next = (p.page + 1).toString();
        }

        return Response.success(data, next);
    } catch (e) {
        return Response.success([], null);
    }
}
