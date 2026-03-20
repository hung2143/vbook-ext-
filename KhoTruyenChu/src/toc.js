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

function chapterNoFrom(name, href) {
    var text = (name || "").toLowerCase();
    var m = text.match(/(?:chuong|chương)\s*0*(\d+)/i);
    if (m) return parseInt(m[1], 10);

    var u = (href || "").toLowerCase();
    var m2 = u.match(/\/chuong-0*(\d+)(?:[-\/]|$)/i);
    if (m2) return parseInt(m2[1], 10);

    return -1;
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

        // Ưu tiên đúng cấu trúc chapter list: h2 chứa link chương.
        var re = /<h2[^>]*>[\s\S]*?<a[^>]+href=["']([^"']*\/chuong[^"']*)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi;
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
                host: host,
                __no: chapterNoFrom(name, href),
                __idx: result.length
            });
            added++;
        }

        // Fallback trong đúng section: lấy link chương bất kỳ nếu site đổi từ h2 sang layout khác.
        if (added < 5) {
            var re2 = /<a[^>]+href=["']([^"']*\/chuong[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
            var m2;
            while ((m2 = re2.exec(scoped)) !== null) {
                var hrefx = normalizeUrl(m2[1], host);
                if (!hrefx || seen[hrefx]) continue;
                var namex = cleanChapterName(stripTags(m2[2]));
                if (!namex) continue;
                seen[hrefx] = true;
                result.push({
                    name: namex,
                    url: hrefx,
                    host: host,
                    __no: chapterNoFrom(namex, hrefx),
                    __idx: result.length
                });
                added++;
            }
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
                host: host,
                __no: chapterNoFrom(name2, href2),
                __idx: result.length
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

    // Chuẩn hóa theo thứ tự chương như danh sách chương: ưu tiên số chương tăng dần.
    data.sort(function (a, b) {
        var an = a.__no;
        var bn = b.__no;
        if (an > 0 && bn > 0 && an !== bn) return an - bn;
        if (an > 0 && bn <= 0) return -1;
        if (an <= 0 && bn > 0) return 1;
        return a.__idx - b.__idx;
    });

    for (var x = 0; x < data.length; x++) {
        delete data[x].__no;
        delete data[x].__idx;
    }

    return Response.success(data);
}
