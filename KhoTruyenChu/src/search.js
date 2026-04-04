var HOST = "https://khotruyenchu.click";

function execute(key, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var data = [];
    var seen = {};

    function normalizeUrl(link) {
        if (!link) return "";
        if (link.startsWith("//")) return "https:" + link;
        if (!link.startsWith("http")) return HOST + link;
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
        // Chỉ giữ URL gốc đến truyện, bỏ phần /chuong-N/ nếu có
        var m = link.match(/^(https?:\/\/[^/]+\/truyen\/[^/?#]+)/);
        var canonLink = m ? m[1] + "/" : link;
        if (seen[canonLink]) return;
        seen[canonLink] = true;
        data.push({
            name: name,
            link: canonLink,
            cover: cover || "",
            description: desc || "",
            host: HOST
        });
    }

    // --- Nguồn 1: WordPress REST API (JSON, đáng tin hơn HTML scraping) ---
    var perPage = 20;
    var offset = (pageNum - 1) * perPage;
    var restUrl = HOST + "/wp-json/wp/v2/posts?search=" + encodeURIComponent(key)
        + "&per_page=" + perPage + "&offset=" + offset
        + "&_fields=id,slug,title,excerpt,link,featured_media_src_url,yoast_head_json";
    var restResp = fetch(restUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (restResp.ok) {
        try {
            var posts = restResp.json();
            if (posts && posts.length > 0) {
                for (var pi = 0; pi < posts.length; pi++) {
                    var post = posts[pi];
                    var pLink = normalizeUrl(post.link || (HOST + "/truyen/" + post.slug + "/"));
                    var pName = (post.title && (post.title.rendered || post.title)) || post.slug || "";
                    pName = pName.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                    var pCover = (post.yoast_head_json && post.yoast_head_json.og_image && post.yoast_head_json.og_image[0] && post.yoast_head_json.og_image[0].url)
                        || post.featured_media_src_url || "";
                    var pDesc = (post.excerpt && (post.excerpt.rendered || post.excerpt)) || "";
                    pDesc = pDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                    pushNovel(pLink, pName, pCover, pDesc);
                }
                var nextPage = data.length === perPage ? (pageNum + 1).toString() : null;
                return Response.success(data, nextPage);
            }
        } catch (e) { /* fall through to HTML scraping */ }
    }

    // --- Nguồn 2: HTML scraping (fallback) ---
    var searchUrl = HOST + "/?s=" + encodeURIComponent(key);
    if (pageNum > 1) searchUrl += "&paged=" + pageNum;

    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return Response.success([], null);

    var doc = response.html("utf-8");

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

    // Fallback nếu card selector không bắt được gì
    if (data.length < 3) {
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

    var next = null;
    var hasNext = doc.html().indexOf("paged=" + (pageNum + 1)) !== -1
        || doc.select("a[href*='/page/" + (pageNum + 1) + "/']").size() > 0;
    if (hasNext && data.length > 0) next = (pageNum + 1).toString();

    return Response.success(data, next);
}
