// gen.js - Lấy danh sách truyện từ trang chủ / danh mục AiTruyen
var HOST = "https://aitruyen.net";

function execute(url, page) {
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

    // Tạo URL danh sách
    // url dạng: https://aitruyen.net/?sort=latest&page=   hoặc  https://aitruyen.net/?status=completed&page=
    var listUrl = url + pageNum;
    // Nếu url không có page param thì thêm vào
    if (listUrl.indexOf("page=") < 0) {
        listUrl = HOST + "/?page=" + pageNum;
    }

    var response = fetch(listUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) {
        return Response.success([{
            name: "AiTruyen: fetch lỗi",
            link: listUrl,
            cover: "",
            description: "HTTP " + response.status,
            host: HOST
        }], null);
    }

    var doc = response.html("utf-8");
    if (!doc) {
        return Response.success([{
            name: "AiTruyen: không parse được HTML",
            link: listUrl,
            cover: "",
            description: "",
            host: HOST
        }], null);
    }

    // Lấy tất cả link truyện
    var anchors = doc.select("a[href*='/truyen/']");
    for (var k = 0; k < anchors.size(); k++) {
        var a = anchors.get(k);
        var href = normalizeUrl(a.attr("href") || "");
        if (!href || href.indexOf("/truyen/") < 0) continue;
        // Bỏ qua nếu URL có đoạn /chuong- (link đến chương)
        if (href.indexOf("/chuong-") >= 0) continue;

        // Lấy tên
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

        // Lấy cover từ img con hoặc img anh em
        var cover = "";
        var img = a.select("img").first();
        if (!img) {
            var parent = a.parent();
            if (parent) img = parent.select("img").first();
        }
        if (img) {
            cover = img.attr("src") || img.attr("data-src") || "";
            // Giải mã URL Next.js image optimization: /_next/image?url=...&w=...&q=...
            if (cover.indexOf("/_next/image") >= 0) {
                var urlParam = cover.match(/url=([^&]+)/);
                if (urlParam) cover = decodeURIComponent(urlParam[1]);
            }
            if (cover && !cover.startsWith("http")) cover = normalizeUrl(cover);
        }

        // Lấy mô tả ngắn
        var desc = "";
        var parentNode = a.parent();
        if (parentNode) {
            var ps = parentNode.select("p");
            for (var pi = 0; pi < ps.size(); pi++) {
                var pText = ps.get(pi).text().trim();
                if (pText && pText.length > 15) { desc = pText; break; }
            }
        }

        pushNovel(href, aName, cover, desc);
    }

    // Kiểm tra trang tiếp theo
    var nextPage = null;
    if (data.length > 0) {
        var hasNextLink = doc.select("a[href*='page=" + (pageNum + 1) + "']").size() > 0
            || doc.select("a[aria-label='Next'], a[rel='next'], a[aria-label='Trang sau']").size() > 0;
        if (hasNextLink) nextPage = (pageNum + 1).toString();
    }

    if (data.length === 0) {
        data.push({
            name: "AiTruyen: không tìm thấy truyện",
            link: listUrl,
            cover: "",
            description: "Trang " + pageNum,
            host: HOST
        });
    }

    return Response.success(data, nextPage);
}
