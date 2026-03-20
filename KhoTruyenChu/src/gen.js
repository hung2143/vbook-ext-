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

        // Bắt tất cả link truyện dạng /truyen/slug/.
        var items = doc.select("a[href*='/truyen/']");
        items.forEach(function (a) {
            var link = a.attr('href');
            if (!link) return;
            if (!link.startsWith('http')) link = 'https://khotruyenchu.sbs' + link;
            if (seen[link]) return;
            seen[link] = true;

            var name = a.text();
            if (!name) name = a.attr('title');
            if (!name) {
                var slug = link.split('/').filter(Boolean).pop();
                name = decodeURIComponent(slug.replace(/-/g, ' '));
            }

            // Lấy cover và mô tả gần anchor (tìm lên tối đa 3 cấp).
            var cover = "";
            var desc = "";
            var cur = a;
            for (var i = 0; i < 3 && cur; i++) {
                var img = cur.select("img").first();
                if (!img && cur.parent()) img = cur.parent().select("img").first();
                if (img && !cover) {
                    cover = img.attr('data-src') || img.attr('src');
                    if (cover && !cover.startsWith('http')) cover = 'https://khotruyenchu.sbs' + cover;
                }
                var p = cur.select(".excerpt, .entry-summary, .jeg_post_excerpt, p").first();
                if (p && !desc) desc = p.text();
                cur = cur.parent();
            }

            data.push({
                name: name,
                link: link,
                cover: cover,
                description: desc,
                host: "https://khotruyenchu.sbs"
            });
        });

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
            hasNext = doc.select("a[rel='next'], a:matchesOwn((?i)sau|next)").size() > 0;
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
