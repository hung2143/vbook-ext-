function normalizeUrl(href, host) {
    if (!href) return "";
    if (!href.startsWith("http")) return host + href;
    return href;
}

function stripTags(text) {
    return (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanChapterName(name) {
    var n = (name || "").replace(/\s+/g, " ").trim();
    if (/^đọc\s*từ\s*đầu$/i.test(n)) return "";
    if (/^chương\s*mới\s*nhất$/i.test(n)) return "";
    return n;
}

function collectChapters(doc, result, seen, host) {
    var html = doc.html() || "";
    var added = 0;

    // Ưu tiên parse phần HTML sau tiêu đề "Danh sách chương" để tránh lẫn các khối khác.
    var start = html.indexOf("Danh sách chương");
    if (start < 0) start = html.indexOf("Danh Sách Chương");
    if (start >= 0) {
        var part = html.substring(start);

        // Cắt tại khối phân trang hoặc phần bình luận để giới hạn vùng parse.
        var endMarkers = ["pagination", "page-numbers", "nav-links", "comments", "Bình luận", "Related", "Footer"];
        var cut = part.length;
        var lowerPart = part.toLowerCase();
        for (var e = 0; e < endMarkers.length; e++) {
            var marker = endMarkers[e].toLowerCase();
            var idx = lowerPart.indexOf(marker);
            if (idx > 0 && idx < cut) cut = idx;
        }
        var scoped = part.substring(0, cut);

        var re = /<a[^>]+href=["']([^"']*\/chuong[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        var m;
        while ((m = re.exec(scoped)) !== null) {
            var href = normalizeUrl(m[1], host);
            if (!href || seen[href]) continue;
            var name = cleanChapterName(stripTags(m[2]));
            if (!name) continue;
            seen[href] = true;
            result.push({
                name: name,
                url: href,
                host: host
            });
            added++;
        }
    }

    // Fallback bằng selector DOM nếu parse theo section không đủ dữ liệu.
    if (added < 5) {
        var nodes = doc.select("a[href*='/chuong']");
        for (var i = 0; i < nodes.size(); i++) {
            var a = nodes.get(i);
            var href2 = normalizeUrl(a.attr("href"), host);
            if (!href2 || seen[href2]) continue;

            var name2 = a.text();
            if (!name2) name2 = a.attr("title");
            name2 = cleanChapterName(name2);
            if (!name2) continue;
            seen[href2] = true;
            result.push({
                name: name2,
                url: href2,
                host: host
            });
            added++;
        }
    }

    return added;
}

function execute(url) {
    var host = "https://khotruyenchu.sbs";
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": host + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var data = [];
    var seen = {};
    collectChapters(doc, data, seen, host);

    var base = url;
    if (!base.endsWith('/')) base += '/';
    base = base.replace(/\/page\/\d+\/$/, '');
    if (!base.endsWith('/')) base += '/';

    // Quét lần lượt /page/2.. đến khi không còn chương mới.
    // Không phụ thuộc số trang hiển thị (thường chỉ hiện 1..6).
    for (var i = 2; i <= 2000; i++) {
        var pageUrl = base + "page/" + i + "/";
        var r = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": url
            }
        });
        if (!r.ok) break;
        var d = r.html("utf-8");
        var added = collectChapters(d, data, seen, host);
        if (added === 0) break;
    }

    return Response.success(data);
}
