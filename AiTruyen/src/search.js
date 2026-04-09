// search.js - Tìm kiếm truyện trên AiTruyen
var HOST = "https://aitruyen.net";

function execute(key, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    function normalizeUrl(link) {
        if (!link) return "";
        if (link.startsWith("//")) return "https:" + link;
        if (!link.startsWith("http")) return HOST + link;
        return link;
    }

    var data = [];
    var seen = {};

    function pushNovel(link, name, cover, desc) {
        if (!link) return;
        if (link.indexOf("/truyen/") < 0) return;
        // Chuẩn hóa: chỉ giữ phần /truyen/slug
        var m = link.match(/^(https?:\/\/[^/]+\/truyen\/[^/?#]+)/);
        var canonLink = m ? m[1] : link;
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

    // === API tìm kiếm ===
    var searchApiUrl = HOST + "/api/stories/search?q=" + encodeURIComponent(key) + "&page=" + pageNum;
    var apiResp = fetch(searchApiUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/",
            "accept": "application/json"
        }
    });

    if (apiResp.ok) {
        try {
            var json = apiResp.json();
            // Thử các cấu trúc JSON có thể có
            var items = json.data || json.stories || json.results || json.items || [];
            if (items && items.length > 0) {
                for (var i = 0; i < items.length; i++) {
                    var item = items[i];
                    var slug = item.slug || item.id || "";
                    if (!slug) continue;
                    var link = HOST + "/truyen/" + slug;
                    var name = item.title || item.name || slug;
                    var cover = item.cover || item.thumbnail || item.image || "";
                    if (cover && !cover.startsWith("http")) cover = normalizeUrl(cover);
                    var desc = item.description || item.summary || "";
                    pushNovel(link, name, cover, desc);
                }
                var hasNext = json.hasNext || json.has_next || (json.page && json.page < json.totalPages);
                return Response.success(data, hasNext ? (pageNum + 1).toString() : null);
            }
        } catch (e) { /* thử HTML scraping */ }
    }

    // === Fallback: HTML scraping trang tìm kiếm ===
    var searchUrl = HOST + "/tim-kiem?q=" + encodeURIComponent(key);
    if (pageNum > 1) searchUrl += "&page=" + pageNum;

    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) return Response.success([], null);

    var doc = response.html("utf-8");

    // Lấy tất cả link truyện từ trang kết quả
    var anchors = doc.select("a[href*='/truyen/']");
    for (var k = 0; k < anchors.size(); k++) {
        var a = anchors.get(k);
        var href = normalizeUrl(a.attr("href") || "");
        if (!href || href.indexOf("/truyen/") < 0) continue;

        // Lấy tên truyện
        var aName = "";
        var h3 = a.select("h3").first();
        if (h3) aName = h3.text();
        if (!aName) aName = a.text();
        if (!aName) aName = a.attr("title") || "";
        if (!aName) {
            var slug = href.split("/").filter(function(s) { return s; }).pop();
            aName = decodeURIComponent((slug || "").replace(/-/g, " "));
        }
        aName = (aName || "").replace(/\s+/g, " ").trim();
        if (!aName) continue;

        // Lấy cover
        var cover = "";
        var img = a.select("img").first();
        if (img) {
            cover = img.attr("src") || img.attr("data-src") || "";
            // Xử lý URL Next.js image optimization
            if (cover.indexOf("/_next/image") >= 0) {
                var urlParam = cover.match(/url=([^&]+)/);
                if (urlParam) cover = decodeURIComponent(urlParam[1]);
            }
        }

        // Lấy mô tả ngắn từ container
        var desc = "";
        var parent = a.parent();
        if (parent) {
            var ps = parent.select("p");
            for (var pi = 0; pi < ps.size(); pi++) {
                var pText = ps.get(pi).text().trim();
                if (pText && pText.length > 20) { desc = pText; break; }
            }
        }

        pushNovel(href, aName, cover, desc);
    }

    // Kiểm tra có trang tiếp theo không
    var nextPage = null;
    if (data.length > 0) {
        var hasNextLink = doc.select("a[href*='page=" + (pageNum + 1) + "']").size() > 0
            || doc.select("a[aria-label='Next'], a[rel='next']").size() > 0;
        if (hasNextLink) nextPage = (pageNum + 1).toString();
    }

    return Response.success(data, nextPage);
}
