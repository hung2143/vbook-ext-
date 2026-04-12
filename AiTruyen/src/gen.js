// gen.js - Lấy danh sách truyện từ trang chủ / danh mục AiTruyen
var HOST = "https://aitruyen.net";

function execute(url, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    function normalizeUrl(link) {
        if (!link) return "";
        if (link.indexOf("//") === 0) return "https:" + link;
        if (link.indexOf("http") !== 0) return HOST + link;
        return link;
    }

    function normalizeCover(src) {
        if (!src) return "";
        if (src.indexOf("/_next/image") >= 0) {
            var m = src.match(/url=([^&]+)/);
            if (m) src = decodeURIComponent(m[1]);
        }
        if (src.indexOf("//") === 0) return "https:" + src;
        if (src.indexOf("http") !== 0) return HOST + src;
        return src;
    }

    var data = [];
    var seen = {};

    function pushNovel(link, name, cover) {
        if (!link || !name) return;
        if (link.indexOf("/truyen/") < 0) return;
        if (link.indexOf("/chuong-") >= 0) return;
        var m = link.match(/^(https?:\/\/[^/]+\/truyen\/[^/?#]+)/);
        var canonLink = m ? m[1] : link;
        if (seen[canonLink]) return;
        seen[canonLink] = true;
        data.push({
            name: (name + "").trim(),
            link: canonLink,
            cover: cover || "",
            host: HOST
        });
    }

    function extractImgCover(el) {
        if (!el) return "";
        var src = el.attr("src") || el.attr("data-src") || "";
        if (!src) {
            // Next.js Image renders srcset; grab first URL entry
            var srcset = el.attr("srcset") || "";
            if (srcset) {
                src = srcset.split(",")[0].trim().split(/\s+/)[0] || "";
            }
        }
        return normalizeCover(src);
    }

    var listUrl = (url && url.indexOf("page=") >= 0)
        ? url + pageNum
        : HOST + "/?page=" + pageNum;

    var response = fetch(listUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (!response || !response.ok) return Response.success([], null);

    var doc = response.html("utf-8");
    if (!doc) return Response.success([], null);

    // Bước 1: Xây dựng bản đồ slug -> cover từ tất cả link ảnh trên trang.
    // Aitruyen.net dùng cấu trúc: <a href="/truyen/slug"><img .../></a> (link ảnh)
    // và <a href="/truyen/slug"><h3>Tên</h3></a> (link tiêu đề) là hai phần tử khác nhau.
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

    // Bước 2: Tìm các thẻ link tiêu đề chứa <h3> và ghép với cover từ bản đồ trên.
    var cards = doc.select("a[href*='/truyen/']:has(h3)");
    for (var i = 0; i < cards.size(); i++) {
        var card = cards.get(i);
        var href = card.attr("href") || "";
        if (!href || href.indexOf("/chuong-") >= 0) continue;
        href = normalizeUrl(href);

        var h3El = card.select("h3").first();
        var name = h3El ? (h3El.text() + "").trim() : "";
        if (!name || name.length < 2) continue;
        if (/^(Truyện mới|Truyện hot|Truyện hoàn|Bảng xếp|Gợi ý|Chương mới|Có thể|KỆ SÁCH|BẢNG XẾP|BIÊN TẬP|NHỮNG BỘ)/i.test(name)) continue;

        // Ưu tiên cover từ bản đồ (lấy từ link ảnh sibling), fallback sang img trực tiếp
        var slugM2 = href.match(/\/truyen\/([^/?#]+)/);
        var storySlug = slugM2 ? slugM2[1] : "";
        var cover = (storySlug && coverMap[storySlug]) || extractImgCover(card.select("img").first());
        pushNovel(href, name, cover);
    }

    // Phương pháp 2 (fallback): link /truyen/ bất kỳ có text hợp lệ
    if (data.length === 0) {
        var allLinks = doc.select("a[href*='/truyen/']");
        for (var j = 0; j < allLinks.size(); j++) {
            var a = allLinks.get(j);
            var ahref = a.attr("href") || "";
            if (!ahref || ahref.indexOf("/chuong-") >= 0) continue;
            ahref = normalizeUrl(ahref);

            var innerH3 = a.select("h3").first();
            var aName = innerH3 ? (innerH3.text() + "").trim() : "";
            if (!aName) aName = (a.attr("aria-label") || a.text() || "").trim();
            if (!aName || aName.length < 2 || aName.length > 200) continue;
            if (/^(Mở truyện|Chương mới|Vào trang|Đọc chương|Xem bảng|Đọc từ đầu|Vào chương|Chương sau|Chương trước|Về trang chủ|Tìm truyện)$/i.test(aName)) continue;

            var aSlugM = ahref.match(/\/truyen\/([^/?#]+)/);
            var aSlug = aSlugM ? aSlugM[1] : "";
            var aCover = (aSlug && coverMap[aSlug]) || extractImgCover(a.select("img").first());
            pushNovel(ahref, aName, aCover);
        }
    }

    var nextPage = null;
    if (data.length > 0) {
        var nextN = pageNum + 1;
        var hasNextLink = doc.select("a[href*='page=" + nextN + "']").size() > 0
            || doc.select("a[rel='next']").size() > 0;
        if (hasNextLink) {
            nextPage = nextN.toString();
        } else if (data.length >= 8 && pageNum === 1) {
            nextPage = "2";
        }
    }

    if (data.length === 0) return Response.success([], null);
    return Response.success(data, nextPage);
}