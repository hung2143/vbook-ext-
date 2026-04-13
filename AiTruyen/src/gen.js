// gen.js - Lấy danh sách truyện từ bảng xếp hạng AiTruyen
// Tham khảo pattern TiemTruyenChu: fetch URL + append &page=N + selectors trực tiếp
var HOST = "https://aitruyen.net";

function execute(url, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    function normalizeCover(src) {
        if (!src) return "";
        // Xử lý /_next/image optimization URLs
        if (src.indexOf("/_next/image") >= 0) {
            var m = src.match(/url=([^&]+)/);
            if (m) src = decodeURIComponent(m[1]);
        }
        if (src.indexOf("//") === 0) return "https:" + src;
        if (src.indexOf("http") !== 0) return HOST + src;
        return src;
    }

    // Xây URL: trang 1 dùng URL gốc, trang 2+ append &page=N
    // (giống cách TiemTruyenChu: url + "&page=" + page)
    var base = (url && url.indexOf("http") === 0) ? url : (HOST + "/bang-xep-hang?type=thinh-hanh");
    base = base.replace(/[&?]page=\d+/g, "");   // bỏ page= cũ nếu có
    var listUrl = pageNum > 1 ? base + "&page=" + pageNum : base;

    var response = fetch(listUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": HOST + "/"
        }
    });

    if (!response || !response.ok) return Response.success([], null);
    var doc = response.html("utf-8");
    if (!doc) return Response.success([], null);

    var data = [];
    var seen = {};

    // Bước 1: Xây coverMap từ link ảnh (a[href*='/truyen/']:has(img))
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
        var img = imgLink.select("img").first();
        if (!img) continue;
        var src = img.attr("src") || img.attr("data-src") || "";
        if (!src) {
            var srcset = img.attr("srcset") || "";
            if (srcset) src = srcset.split(",")[0].trim().split(/\s+/)[0] || "";
        }
        var cv = normalizeCover(src);
        if (cv) coverMap[slug] = cv;
    }

    // Bước 2: Lấy tiêu đề từ link chứa <h3>, ghép cover từ coverMap
    var cards = doc.select("a[href*='/truyen/']:has(h3)");
    for (var i = 0; i < cards.size(); i++) {
        var card = cards.get(i);
        var href = card.attr("href") || "";
        if (!href || href.indexOf("/chuong-") >= 0) continue;
        if (href.indexOf("http") !== 0) href = HOST + href;

        var h3 = card.select("h3").first();
        var name = h3 ? (h3.text() + "").trim() : "";
        if (!name || name.length < 2) continue;
        if (/^(Mở truyện|Bảng xếp|Gợi ý|KỆ SÁCH|BẢNG XẾP)/i.test(name)) continue;

        var m2 = href.match(/\/truyen\/([^/?#]+)/);
        var canonLink = m2 ? (HOST + "/truyen/" + m2[1]) : href;
        if (seen[canonLink]) continue;
        seen[canonLink] = true;

        data.push({
            name: name,
            link: canonLink,
            cover: (m2 && coverMap[m2[1]]) || "",
            host: HOST
        });
    }

    // Phát hiện trang tiếp: tồn tại link a[href*='&page=N+1'] trong pagination
    var nextPage = null;
    if (data.length > 0) {
        var nextNum = pageNum + 1;
        if (doc.select("a[href*='&page=" + nextNum + "']").size() > 0) {
            nextPage = String(nextNum);
        }
    }

    return Response.success(data, nextPage);
}