function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function toSearchText(s) {
    if (!s) return "";
    var t = ("" + s).toLowerCase();
    if (typeof t.normalize === "function") {
        t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    t = t.replace(/đ/g, "d");
    return t.replace(/\s+/g, " ").trim();
}

function parseItemsFromResponse(response) {
    if (!response || !response.ok) return null;
    var json = response.json();
    if (!json || !json.items) return { items: [], pagination: null };
    return {
        items: json.items || [],
        pagination: json.pagination || null
    };
}

function mapItems(items) {
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
    return data;
}

function directSearch(key, pageNum) {
    var searchUrl = "https://trangtruyen.site/api/stories?q=" + encodeURIComponent(key || "") + "&page=" + pageNum;
    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });

    var parsed = parseItemsFromResponse(response);
    if (!parsed) return null;

    var next = null;
    var p = parsed.pagination;
    if (p && p.page && p.totalPages && p.page < p.totalPages) {
        next = (p.page + 1).toString();
    }

    return Response.success(mapItems(parsed.items), next);
}

function fallbackSearchNoAccent(rawKey, pageNum) {
    var key = toSearchText(rawKey);
    if (!key) return Response.success([], null);

    var pageSize = 24;
    var needed = pageNum * pageSize;
    var collected = [];
    var seen = {};
    var sources = [
        { sort: "latest", maxPages: 12 },
        { sort: "popular", maxPages: 8 }
    ];

    for (var s = 0; s < sources.length; s++) {
        var src = sources[s];
        for (var p = 1; p <= src.maxPages; p++) {
            if (collected.length >= needed + pageSize) break;

            var url = "https://trangtruyen.site/api/stories?sort=" + src.sort + "&page=" + p;
            var resp = fetch(url, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": "https://trangtruyen.site/"
                }
            });
            var parsed = parseItemsFromResponse(resp);
            if (!parsed) continue;

            var items = parsed.items || [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                if (!it.slug || seen[it.slug]) continue;
                seen[it.slug] = true;

                var hay = toSearchText((it.title || "") + " " + (it.slug || "") + " " + (it.author || ""));
                if (hay.indexOf(key) === -1) continue;

                collected.push(it);
            }
        }
    }

    var start = (pageNum - 1) * pageSize;
    var picked = collected.slice(start, start + pageSize);
    var next = (collected.length > start + pageSize) ? (pageNum + 1).toString() : null;
    return Response.success(mapItems(picked), next);
}

function execute(key, page) {
    try {
        if (!key || !("" + key).trim()) return Response.success([], null);

        var pageNum = parseInt(page || "1", 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        var primary = directSearch(key, pageNum);
        if (primary && primary.data && primary.data.length > 0) return primary;

        return fallbackSearchNoAccent(key, pageNum);
    } catch (e) {
        return Response.success([], null);
    }
}
