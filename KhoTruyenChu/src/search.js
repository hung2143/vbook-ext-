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

    function stripHtml(s) {
        return (s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    }

    function pushNovel(link, name, cover, desc) {
        if (!link) return;
        // Chuẩn hoá link truyện
        if (link.indexOf("/truyen/") < 0) return;
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

    // === Nguồn chính: WP REST API cho taxonomy bo_truyen ===
    // Truyện trên khotruyenchu là taxonomy bo_truyen, KHÔNG phải post
    var perPage = 20;
    var apiUrl = HOST + "/wp-json/wp/v2/bo_truyen?search=" + encodeURIComponent(key)
        + "&per_page=" + perPage
        + "&page=" + pageNum;

    var apiResp = fetch(apiUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (apiResp.ok) {
        try {
            var terms = apiResp.json();
            if (terms && terms.length > 0) {
                for (var i = 0; i < terms.length; i++) {
                    var term = terms[i];
                    var link = normalizeUrl(term.link || (HOST + "/truyen/" + term.slug + "/"));
                    var name = stripHtml(term.name || term.slug || "");
                    var desc = stripHtml(term.description || "");

                    // Lấy ảnh cover từ yoast_head_json nếu có
                    var cover = "";
                    try {
                        if (term.yoast_head_json && term.yoast_head_json.og_image && term.yoast_head_json.og_image[0]) {
                            cover = term.yoast_head_json.og_image[0].url || "";
                        }
                    } catch (ignore) {}

                    // Fallback: tìm ảnh trong yoast_head (meta tag)
                    if (!cover && term.yoast_head) {
                        var ogMatch = term.yoast_head.match(/property="og:image"\s+content="([^"]+)"/);
                        if (ogMatch) cover = ogMatch[1];
                    }

                    pushNovel(link, name, cover, desc);
                }

                var nextPage = terms.length >= perPage ? (pageNum + 1).toString() : null;
                return Response.success(data, nextPage);
            }
        } catch (e) { /* fall through */ }
    }

    // === Fallback: HTML scraping qua trang tìm kiếm WP ===
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

    // Tìm tất cả link truyện trong trang
    var anchors = doc.select("a[href*='/truyen/']");
    for (var k = 0; k < anchors.size(); k++) {
        var a = anchors.get(k);
        var href = normalizeUrl(a.attr("href"));
        if (!href) continue;

        var aName = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!aName) aName = a.attr("title") || "";
        if (!aName) {
            var slug = href.split('/').filter(Boolean).pop();
            aName = decodeURIComponent((slug || "").replace(/-/g, ' '));
        }
        aName = aName.replace(/^\s*bộ\s*truyện\s*/i, "").trim();

        // Lấy cover từ thẻ cha gần nhất
        var cover2 = "";
        var parent = a.parent();
        if (parent) {
            var img = parent.select("img").first();
            if (img) {
                cover2 = img.attr("data-src") || img.attr("src") || "";
                cover2 = normalizeUrl(cover2);
            }
        }

        pushNovel(href, aName, cover2, "");
    }

    var next = null;
    if (data.length > 0) {
        var hasNext = doc.html().indexOf("paged=" + (pageNum + 1)) !== -1
            || doc.select("a[href*='/page/" + (pageNum + 1) + "/']").size() > 0;
        if (hasNext) next = (pageNum + 1).toString();
    }

    return Response.success(data, next);
}
