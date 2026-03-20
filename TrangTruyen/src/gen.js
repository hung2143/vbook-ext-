function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function safeDecodeSlug(link) {
    try {
        var slug = (link || "").split("/");
        slug = slug[slug.length - 1] || "";
        return decodeURIComponent(slug.replace(/-/g, " "));
    } catch (e) {
        return (link || "").replace(/-/g, " ");
    }
}

function pickCoverFromNode(node) {
    if (!node) return "";
    var img = node.select("img").first();
    if (!img) return "";

    var c = img.attr("data-src") || img.attr("src") || "";
    if (!c) {
        var srcset = img.attr("srcset") || "";
        if (srcset) {
            var first = srcset.split(",")[0];
            if (first) c = first.trim().split(" ")[0] || "";
        }
    }
    return normalizeUrl(c);
}

function execute(url, page) {
    try {
        if (!page) page = "1";
        var pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        var listUrl = url || "https://trangtruyen.site/stories?page=";
        if (listUrl.indexOf("{page}") !== -1) {
            listUrl = listUrl.replace("{page}", pageNum);
        } else if (listUrl.indexOf("page=") >= 0) {
            listUrl = listUrl.replace(/page=\d+/i, "page=" + pageNum);
        } else {
            listUrl += pageNum;
        }

        var response = fetch(listUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) {
            return Response.success([{
                name: "TrangTruyen: fetch lỗi",
                link: "https://trangtruyen.site/stories",
                cover: "",
                description: "HTTP " + response.status + " | " + listUrl,
                host: "https://trangtruyen.site"
            }], null);
        }

        var doc = response.html("utf-8");
        if (!doc) {
            return Response.success([{
                name: "TrangTruyen: doc trống",
                link: "https://trangtruyen.site/stories",
                cover: "",
                description: "Không parse được HTML",
                host: "https://trangtruyen.site"
            }], null);
        }

        var data = [];
        var seen = {};

        var cards = doc.select("article, .story-card, .grid a[href*='/stories/'], a[href*='/stories/']");
        for (var i = 0; i < cards.size(); i++) {
            var node = cards.get(i);
            var a = node;
            if (a.tagName && a.tagName().toLowerCase() !== "a") {
                a = node.select("a[href*='/stories/']").first();
            }
            if (!a) continue;

            var link = normalizeUrl(a.attr("href"));
            if (!link) continue;
            if (link.indexOf("/stories/") < 0) continue;
            if (seen[link]) continue;

            var name = (a.text() || a.attr("title") || "").replace(/\s+/g, " ").trim();
            if (!name) name = safeDecodeSlug(link);

            seen[link] = true;
            data.push({
                name: name,
                link: link,
                cover: pickCoverFromNode(node),
                description: "",
                host: "https://trangtruyen.site"
            });
        }

        if (data.length === 0) {
            var html = doc.html() || "";
            var regex = /(https:\/\/trangtruyen\.site\/stories\/[^"'>\s]+|\/stories\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = normalizeUrl(m[0]);
                if (!link2 || seen[link2]) continue;
                seen[link2] = true;

                data.push({
                    name: safeDecodeSlug(link2),
                    link: link2,
                    cover: "",
                    description: "",
                    host: "https://trangtruyen.site"
                });
            }

            if (data.length === 0) {
                data.push({
                    name: "TrangTruyen: không tìm thấy truyện",
                    link: "https://trangtruyen.site/stories",
                    cover: "",
                    description: "HTML length: " + html.length + " | URL: " + listUrl,
                    host: "https://trangtruyen.site"
                });
            }
        }

        var next = null;
        var htmlLower = (doc.html() || "").toLowerCase();
        var nextQuery = "page=" + (pageNum + 1);
        if (htmlLower.indexOf(nextQuery) !== -1 && data.length > 0) {
            next = (pageNum + 1).toString();
        }

        return Response.success(data, next);
    } catch (e) {
        return Response.success([{
            name: "TrangTruyen: lỗi script",
            link: "https://trangtruyen.site/stories",
            cover: "",
            description: e ? e.toString() : "Lỗi không xác định",
            host: "https://trangtruyen.site"
        }], null);
    }
}
