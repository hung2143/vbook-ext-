function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return "https://trangtruyen.site" + link;
    return link;
}

function execute(url) {
    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) return Response.success([]);

        var doc = response.html("utf-8");
        var data = [];
        var seen = {};

        var selectors = [
            "a[href*='/read/']",
            "a[href*='/chapter/']",
            "a[href*='chuong-']"
        ];

        for (var s = 0; s < selectors.length; s++) {
            var items = doc.select(selectors[s]);
            for (var i = 0; i < items.size(); i++) {
                var e = items.get(i);
                var link = normalizeUrl(e.attr("href"));
                if (!link) continue;
                if (seen[link]) continue;

                var name = (e.text() || e.attr("title") || "").replace(/\s+/g, " ").trim();
                if (!name) continue;

                if (/đọc\s*thử|đăng\s*nhập|login/i.test(name)) continue;

                seen[link] = true;
                data.push({
                    name: name,
                    url: link,
                    host: "https://trangtruyen.site"
                });
            }
            if (data.length > 0) break;
        }

        if (data.length === 0) {
            var html = doc.html() || "";
            var regex = /(https:\/\/trangtruyen\.site\/(?:read|chapter)\/[^"'>\s]+|\/(?:read|chapter)\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = normalizeUrl(m[0]);
                if (!link2 || seen[link2]) continue;
                seen[link2] = true;
                data.push({
                    name: "Chương " + (data.length + 1),
                    url: link2,
                    host: "https://trangtruyen.site"
                });
            }
        }

        return Response.success(data);
    } catch (e) {
        return Response.success([]);
    }
}
