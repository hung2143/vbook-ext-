function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function extractSlug(url) {
    var m = (url || "").match(/\/stories\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

function fetchJson(url) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });
    if (!response.ok) return null;
    return response.json();
}

function listFromApi(url) {
    var slug = extractSlug(url);
    var storyId = "";

    if (slug) {
        var storyRes = fetchJson("https://trangtruyen.site/api/stories/" + slug);
        if (storyRes && storyRes.story && storyRes.story.id) {
            storyId = storyRes.story.id;
        }
    }

    if (!storyId) {
        var chapterId = extractChapterId(url);
        if (chapterId) {
            var chapterRes = fetchJson("https://trangtruyen.site/api/chapters/" + chapterId);
            if (chapterRes && chapterRes.story && chapterRes.story.id) {
                storyId = chapterRes.story.id;
            }
        }
    }

    if (!storyId) return [];

    var data = [];
    var page = 1;
    var safety = 0;
    while (safety < 200) {
        safety += 1;
        var chapterPage = fetchJson("https://trangtruyen.site/api/stories/" + storyId + "/chapters?page=" + page);
        if (!chapterPage || !chapterPage.items || chapterPage.items.length === 0) break;

        var items = chapterPage.items;
        for (var i = 0; i < items.length; i++) {
            var it = items[i] || {};
            if (!it.id) continue;

            var name = (it.title || ("Chương " + (it.chapterNumber || (data.length + 1)))).replace(/\s+/g, " ").trim();
            data.push({
                name: name,
                url: "https://trangtruyen.site/read/" + it.id,
                host: "https://trangtruyen.site"
            });
        }

        var p = chapterPage.pagination || null;
        if (!p || !p.page || !p.totalPages || p.page >= p.totalPages) break;
        page += 1;
    }

    return data;
}

function listFromHtml(url) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });
    if (!response.ok) return [];

    var doc = response.html("utf-8");
    var data = [];
    var seen = {};

    var selectors = [
        "a[href*='/read/']",
        "a[href*='/chapter/']",
        "a[href*='chuong-']"
    ];

    for (var s = 0; s < selectors.length; s++) {
        var items = doc.select(selectors[s]);
        for (var i = 0; i < items.size(); i++) {
            var e = items.get(i);
            var link = normalizeUrl(e.attr("href"));
            if (!link) continue;
            if (seen[link]) continue;

            var name = (e.text() || e.attr("title") || "").replace(/\s+/g, " ").trim();
            if (!name) continue;

            if (/đọc\s*thử|đăng\s*nhập|login/i.test(name)) continue;

            seen[link] = true;
            data.push({
                name: name,
                url: link,
                host: "https://trangtruyen.site"
            });
        }
        if (data.length > 0) break;
    }

    if (data.length === 0) {
        var html = doc.html() || "";
        var regex = /(https:\/\/trangtruyen\.site\/(?:read|chapter)\/[^"'>\s]+|\/(?:read|chapter)\/[^"'>\s]+)/g;
        var m;
        while ((m = regex.exec(html)) !== null) {
            var link2 = normalizeUrl(m[0]);
            if (!link2 || seen[link2]) continue;
            seen[link2] = true;
            data.push({
                name: "Chương " + (data.length + 1),
                url: link2,
                host: "https://trangtruyen.site"
            });
        }
    }

    return data;
}

function execute(url) {
    try {
        var data = listFromApi(url);
        if (data.length > 0) return Response.success(data);
        return Response.success(listFromHtml(url));
    } catch (e) {
        return Response.success([]);
    }
}
