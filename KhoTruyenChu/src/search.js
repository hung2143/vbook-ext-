function execute(key, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var searchUrl = "https://khotruyenchu.sbs/?s=" + encodeURIComponent(key);
    if (pageNum > 1) searchUrl += "&paged=" + pageNum;

    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://khotruyenchu.sbs/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var data = [];
    var seen = {};

    function normalizeUrl(link) {
        if (!link) return "";
        if (!link.startsWith("http")) return "https://khotruyenchu.sbs" + link;
        return link;
    }

    function getNameFromAnchor(a, link) {
        var name = a.text();
        if (!name) name = a.attr("title");
        if (!name) {
            var img = a.select("img").first();
            if (img) name = img.attr("alt");
        }
        if (!name) {
            var slug = link.split('/').filter(Boolean).pop();
            name = decodeURIComponent(slug.replace(/-/g, ' '));
        }
        return (name || "").replace(/\s+/g, " ").trim();
    }

    function pushNovel(link, name, cover, desc) {
        if (!link || link.indexOf("/truyen/") < 0) return;
        if (seen[link]) return;
        seen[link] = true;
        data.push({
            name: name,
            link: link,
            cover: cover || "",
            description: desc || "",
            host: "https://khotruyenchu.sbs"
        });
    }

    var cards = doc.select("article, .post, .posts .item, .jeg_post");
    cards.forEach(function (card) {
        var a = card.select("a[href*='/truyen/']").first();
        if (!a) return;
        var link = normalizeUrl(a.attr("href"));
        var name = getNameFromAnchor(a, link);
        var img = card.select("img").first();
        var cover = "";
        if (img) {
            cover = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "";
            cover = normalizeUrl(cover);
        }
        var desc = "";
        var ex = card.select(".excerpt, .entry-summary, .jeg_post_excerpt, p").first();
        if (ex) desc = ex.text();
        pushNovel(link, name, cover, desc);
    });

    if (data.length === 0) {
        var items = doc.select("a[href*='/truyen/']");
        items.forEach(function (e) {
            var link = normalizeUrl(e.attr("href"));
            if (!link) return;
            var name = getNameFromAnchor(e, link);
            var img = e.select("img").first();
            var cover = "";
            if (img) {
                cover = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "";
                cover = normalizeUrl(cover);
            }
            pushNovel(link, name, cover, "");
        });
    }

    for (var j = 0; j < data.length; j++) {
        if (data[j].cover && data[j].description) continue;
        try {
            var r2 = fetch(data[j].link, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": searchUrl
                }
            });
            if (!r2.ok) continue;
            var d2 = r2.html("utf-8");
            if (!data[j].cover) {
                var c = d2.select("meta[property='og:image']").attr("content");
                if (!c) {
                    var im2 = d2.select(".entry-content img, article img, img").first();
                    if (im2) c = im2.attr("src");
                }
                data[j].cover = normalizeUrl(c || "");
            }
            if (!data[j].description) {
                var de = d2.select("meta[name='description']").attr("content");
                if (!de) {
                    var p2 = d2.select(".entry-content p, article p, p").first();
                    if (p2) de = p2.text();
                }
                data[j].description = de || "";
            }
        } catch (ignore) {}
    }

    var next = null;
    var expectedNext = "&paged=" + (pageNum + 1);
    var hasNext = doc.html().indexOf(expectedNext) !== -1 || doc.select("a[href*='/page/" + (pageNum + 1) + "/']").size() > 0;
    if (hasNext && data.length > 0) next = (pageNum + 1).toString();

    return Response.success(data, next);
}
