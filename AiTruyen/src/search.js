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

    function extractImgCover(img) {
        if (!img) return "";
        var src = img.attr("src") || img.attr("data-src") || "";
        if (!src) {
            var srcset = img.attr("srcset") || "";
            if (srcset) src = srcset.split(",")[0].trim().split(/\s+/)[0] || "";
        }
        if (!src) return "";
        if (src.indexOf("/_next/image") >= 0) {
            var urlParam = src.match(/url=([^&]+)/);
            if (urlParam) src = decodeURIComponent(urlParam[1]);
        }
        if (src.indexOf("//") === 0) return "https:" + src;
        if (src.indexOf("http") !== 0) return HOST + src;
        return src;
    }

    // Bước 1: Xây dựng bản đồ slug -> cover từ tất cả link ảnh
    var coverMap = {};
    var imgLinks = doc.select("a[href*='/truyen/']:has(img)");
    for (var ci = 0; ci < imgLinks.size(); ci++) {
        var imgLink = imgLinks.get(ci);
        var ilHref = imgLink.attr("href") || "";
        if (!ilHref || ilHref.indexOf("/chuong-") >= 0) continue;
        var slugM = ilHref.match(/\/truyen\/([^/?#]+)/);
        if (!slugM) continue;
        var slug = slugM[1];
        if (coverMap[slug]) continue;
        var ilCover = extractImgCover(imgLink.select("img").first());
        if (ilCover) coverMap[slug] = ilCover;
    }

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
            var slug2 = href.split("/").filter(function(s) { return s; }).pop();
            aName = decodeURIComponent((slug2 || "").replace(/-/g, " "));
        }
        aName = (aName || "").replace(/\s+/g, " ").trim();
        if (!aName) continue;

        // Lấy cover: ưu tiên bản đồ cover (từ link ảnh sibling), rồi mới tìm img trực tiếp
        var hrefSlugM = href.match(/\/truyen\/([^/?#]+)/);
        var hrefSlug = hrefSlugM ? hrefSlugM[1] : "";
        var cover = (hrefSlug && coverMap[hrefSlug]) || extractImgCover(a.select("img").first());

        // Lấy mô tả ngắn - không dùng .parent() vì vBook runtime không hỗ trợ
        var desc = "";

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
