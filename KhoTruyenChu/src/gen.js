function execute(url, page) {
    try {
        if (!page) page = "1";
        var pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        // Expect input dạng https://khotruyenchu.sbs/page/ hoặc .../top-qidian/page/
        // Trang 1 dùng root (không có /page/1/), các trang sau ghép /page/{n}/.
        var base = url;
        if (!base.endsWith("/")) base += "/";
        var listUrl = pageNum === 1 ? base.replace(/page\/?$/, "") || base : base + pageNum + "/";

        var response = fetch(listUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://khotruyenchu.sbs/"
            }
        });
        if (!response.ok) {
            return Response.success([{
                name: "KhoTruyenChu: fetch lỗi",
                link: listUrl,
                cover: "",
                description: "HTTP " + response.status,
                host: "https://khotruyenchu.sbs"
            }], null);
        }

        var doc = response.html("utf-8");
        if (!doc) {
            return Response.success([{
                name: "KhoTruyenChu: doc trống",
                link: listUrl,
                cover: "",
                description: "Không parse được HTML",
                host: "https://khotruyenchu.sbs"
            }], null);
        }

        var seen = {};
        var data = [];

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

        // Ưu tiên parse theo card để lấy được ảnh/mô tả rõ ràng hơn.
        var cards = doc.select("article, .post, .posts .item, .jeg_post");
        for (var i = 0; i < cards.size(); i++) {
            var card = cards.get(i);
            var a = card.select("a[href*='/truyen/']").first();
            if (!a) continue;
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
        }

        // Fallback: lấy toàn bộ anchor truyện.
        // Một số layout WordPress chỉ có 1 article bao toàn bộ nội dung,
        // nên parse theo card có thể chỉ nhặt được 1 item đầu tiên.
        if (data.length < 5) {
            var items = doc.select("a[href*='/truyen/']");
            for (var k = 0; k < items.size(); k++) {
                var a2 = items.get(k);
                var link2a = normalizeUrl(a2.attr("href"));
                if (!link2a) continue;
                var name2a = getNameFromAnchor(a2, link2a);
                var img2a = a2.select("img").first();
                var cover2a = "";
                if (img2a) {
                    cover2a = img2a.attr("data-src") || img2a.attr("data-lazy-src") || img2a.attr("src") || "";
                    cover2a = normalizeUrl(cover2a);
                }
                pushNovel(link2a, name2a, cover2a, "");
            }
        }

        // Enrich ảnh/mô tả trực tiếp từ trang truyện nếu card list chưa có.
        var enrichLimit = Math.min(data.length, 10);
        for (var j = 0; j < enrichLimit; j++) {
            if (data[j].cover && data[j].description) continue;
            try {
                var r2 = fetch(data[j].link, {
                    headers: {
                        "user-agent": UserAgent.chrome(),
                        "referer": listUrl
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

        // Fallback regex nếu selector không tìm thấy gì.
        if (data.length === 0) {
            var html = doc.html();
            var regex = /(https:\/\/khotruyenchu\.sbs\/truyen\/[^"'>\s]+|\/truyen\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = m[0];
                if (!link2.startsWith('http')) link2 = 'https://khotruyenchu.sbs' + link2;
                if (seen[link2]) continue;
                seen[link2] = true;
                var slug2 = link2.split('/').filter(Boolean).pop();
                var name2 = decodeURIComponent(slug2.replace(/-/g, ' '));
                data.push({
                    name: name2,
                    link: link2,
                    cover: "",
                    description: "",
                    host: "https://khotruyenchu.sbs"
                });
            }
        }

        var next = null;
        var nextPageNum = pageNum + 1;
        var expectedNext = "/page/" + nextPageNum + "/";
        var hasNext = doc.select("a[href*='" + expectedNext + "']").size() > 0;
        if (!hasNext) {
            // Fallback: tìm nút phân trang có rel="next" hoặc text "Sau".
            hasNext = doc.select("a[rel='next']").size() > 0;
            if (!hasNext) hasNext = doc.html().toLowerCase().indexOf("sau") !== -1;
        }
        if (hasNext && data.length > 0) next = nextPageNum.toString();

        if (data.length === 0) {
            data.push({
                name: "KhoTruyenChu: không tìm thấy truyện",
                link: listUrl,
                cover: "",
                description: "HTML length: " + (doc.html() ? doc.html().length : 0),
                host: "https://khotruyenchu.sbs"
            });
        }

        return Response.success(data, next);
    } catch (e) {
        return Response.success([{
            name: "KhoTruyenChu: lỗi script",
            link: url,
            cover: "",
            description: e.toString(),
            host: "https://khotruyenchu.sbs"
        }], null);
    }
}
