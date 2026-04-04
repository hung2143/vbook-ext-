function execute(url, page) {
    try {
        if (!page) page = "1";
        var pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        // Expect input dạng https://khotruyenchu.click/page/ hoặc .../top-qidian/page/
        // Trang 1 dùng root (không có /page/1/), các trang sau ghép /page/{n}/.
        var base = url;
        if (!base.endsWith("/")) base += "/";
        var listUrl = pageNum === 1 ? base.replace(/page\/?$/, "") || base : base + pageNum + "/";

        var response = fetch(listUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://khotruyenchu.click/"
            }
        });
        if (!response.ok) {
            return Response.success([{
                name: "KhoTruyenChu: fetch lỗi",
                link: listUrl,
                cover: "",
                description: "HTTP " + response.status,
                host: "https://khotruyenchu.click"
            }], null);
        }

        var doc = response.html("utf-8");
        if (!doc) {
            return Response.success([{
                name: "KhoTruyenChu: doc trống",
                link: listUrl,
                cover: "",
                description: "Không parse được HTML",
                host: "https://khotruyenchu.click"
            }], null);
        }

        var seen = {};
        var data = [];

        function normalizeUrl(link) {
            if (!link) return "";
            if (link.startsWith("//")) return "https:" + link;
            if (!link.startsWith("http")) return "https://khotruyenchu.click" + link;
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
            // Nếu đã có nhưng chưa có cover, cập nhật cover
            if (seen[link]) {
                if (cover && !data[seen[link] - 1].cover) {
                    data[seen[link] - 1].cover = cover;
                }
                if (desc && !data[seen[link] - 1].description) {
                    data[seen[link] - 1].description = desc;
                }
                return;
            }
            data.push({
                name: name,
                link: link,
                cover: cover || "",
                description: desc || "",
                host: "https://khotruyenchu.click"
            });
            seen[link] = data.length; // Store 1-based index for update
        }

        // Ưu tiên parse theo card để lấy được ảnh/mô tả rõ ràng hơn.
        var cards = doc.select("article, .post, .posts .item, .jeg_post, .hs-item, .hs-slide, .story-item");
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

        // Fallback: lấy toàn bộ anchor truyện.
        // Một số layout WordPress chỉ có 1 article bao toàn bộ nội dung,
        // nên parse theo card có thể chỉ nhặt được 1 item đầu tiên.
        if (data.length < 5) {
            // Ưu tiên anchor có ảnh (class hs-thumb) trước
            var thumbLinks = doc.select("a.hs-thumb[href*='/truyen/']");
            for (var tk = 0; tk < thumbLinks.size(); tk++) {
                var ta = thumbLinks.get(tk);
                var tlink = normalizeUrl(ta.attr("href"));
                if (!tlink) continue;
                var tname = getNameFromAnchor(ta, tlink);
                var tcover = extractCoverFromNode(ta);
                pushNovel(tlink, tname, tcover, "");
            }
            // Sau đó lấy các anchor text
            var items = doc.select("a[href*='/truyen/']");
            for (var k = 0; k < items.size(); k++) {
                var a2 = items.get(k);
                var link2a = normalizeUrl(a2.attr("href"));
                if (!link2a) continue;
                var name2a = getNameFromAnchor(a2, link2a);
                // Tìm cover từ parent element (.hs-item) nếu anchor không có ảnh
                var cover2a = extractCoverFromNode(a2);
                if (!cover2a) {
                    var parentItem = a2.parent();
                    if (parentItem) cover2a = extractCoverFromNode(parentItem);
                }
                pushNovel(link2a, name2a, cover2a, "");
            }
        }

        // Bỏ bước enrich theo từng truyện để giảm số request, giúp app mở list nhanh hơn.

        // Fallback regex nếu selector không tìm thấy gì.
        if (data.length === 0) {
            var html = doc.html();
            var regex = /(https:\/\/khotruyenchu\.click\/truyen\/[^"'>\s]+|\/truyen\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = m[0];
                if (!link2.startsWith('http')) link2 = 'https://khotruyenchu.click' + link2;
                if (seen[link2]) continue;
                seen[link2] = true;
                var slug2 = link2.split('/').filter(Boolean).pop();
                var name2 = decodeURIComponent(slug2.replace(/-/g, ' '));
                data.push({
                    name: name2,
                    link: link2,
                    cover: "",
                    description: "",
                    host: "https://khotruyenchu.click"
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
                host: "https://khotruyenchu.click"
            });
        }

        return Response.success(data, next);
    } catch (e) {
        return Response.success([{
            name: "KhoTruyenChu: lỗi script",
            link: url,
            cover: "",
            description: e.toString(),
            host: "https://khotruyenchu.click"
        }], null);
    }
}
