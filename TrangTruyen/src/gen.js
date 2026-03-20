function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function buildListUrl(url, pageNum) {
    var listUrl = url || "https://trangtruyen.site/stories?page={page}";
    if (listUrl.indexOf("{page}") !== -1) return listUrl.replace("{page}", pageNum);
    if (listUrl.indexOf("page=") >= 0) return listUrl.replace(/page=\d*/i, "page=" + pageNum);
    return listUrl + pageNum;
}

function toApiStoriesUrl(listUrl) {
    if (listUrl.indexOf("/api/stories") >= 0) return listUrl;

    var m = listUrl.match(/^https?:\/\/[^\/]+(\/stories(?:\?[^#]*)?)/i);
    if (!m) return "https://trangtruyen.site/api/stories?page=1";

    var path = m[1] || "/stories";
    return "https://trangtruyen.site/api" + path;
}

function execute(url, page) {
    try {
        var pageNum = parseInt(page || "1", 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        var listUrl = buildListUrl(url, pageNum);
        var apiUrl = toApiStoriesUrl(listUrl);

        var response = fetch(apiUrl, {
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
            var slug = it.slug || "";
            if (!slug) continue;

            data.push({
                name: it.title || slug,
                link: "https://trangtruyen.site/stories/" + slug,
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
