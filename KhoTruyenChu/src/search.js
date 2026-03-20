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
        if (link.startsWith("//")) return "https:" + link;
        if (!link.startsWith("http")) return "https://khotruyenchu.sbs" + link;
        return link;
    }

    function pickFromSrcSet(srcset) {
        if (!srcset) return "";
        var first = srcset.split(",")[0];
        if (!first) return "";
        return first.trim().split(" ")[0] || "";
    }

    function extractCoverFromImg(img) {
        if (!img) return "";
        var c = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "";
        if (!c) c = pickFromSrcSet(img.attr("data-srcset") || img.attr("srcset"));
        return normalizeUrl(c);
    }

    function extractCoverFromNode(node) {
        if (!node) return "";
        var img = node.select("img").first();
        var c = extractCoverFromImg(img);
        if (c) return c;

        var styleNode = node.select("[style*='background-image']").first();
        if (styleNode) {
            var st = styleNode.attr("style") || "";
            var m = st.match(/url\((['"]?)([^'")]+)\1\)/i);
            if (m) return normalizeUrl(m[2]);
        }
        return "";
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
        return (name || "")
            .replace(/^\s*bộ\s*truyện\s*/i, "")
            .replace(/\s+/g, " ")
            .trim();
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
    for (var i = 0; i < cards.size(); i++) {
        var card = cards.get(i);
        var a = card.select("a[href*='/truyen/']").first();
        if (!a) continue;
        var link = normalizeUrl(a.attr("href"));
        var name = getNameFromAnchor(a, link);
        var cover = extractCoverFromNode(card);
        var desc = "";
        var ex = card.select(".excerpt, .entry-summary, .jeg_post_excerpt, p").first();
        if (ex) desc = ex.text();
        pushNovel(link, name, cover, desc);
    }

    // Layout có thể gói toàn bộ kết quả trong 1 card lớn,
    // khi đó parse card chỉ ra 1 item đầu tiên.
    if (data.length < 5) {
        var items = doc.select("a[href*='/truyen/']");
        for (var k = 0; k < items.size(); k++) {
            var e = items.get(k);
            var link2 = normalizeUrl(e.attr("href"));
            if (!link2) continue;
            var name2 = getNameFromAnchor(e, link2);
            var cover2 = extractCoverFromNode(e);
            pushNovel(link2, name2, cover2, "");
        }
    }

    var enrichLimit = Math.min(data.length, 30);
    for (var j = 0; j < enrichLimit; j++) {
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
                if (!c) c = d2.select("meta[name='twitter:image']").attr("content");
                if (!c) c = extractCoverFromNode(d2.select(".entry-content, article, .post, body").first());
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
