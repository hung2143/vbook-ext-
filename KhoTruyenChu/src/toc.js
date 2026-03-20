function normalizeUrl(href, host) {
    if (!href) return "";
    if (!href.startsWith("http")) return host + href;
    return href;
}

function cleanChapterName(name) {
    var n = (name || "").replace(/\s+/g, " ").trim();
    if (/^đọc\s*từ\s*đầu$/i.test(n)) return "";
    if (/^chương\s*mới\s*nhất$/i.test(n)) return "";
    return n;
}

function collectChapters(doc, result, seen, host) {
    var added = 0;

    // Lấy đúng phần danh sách chương: các card chapter trong thẻ h2.
    var chapterNodes = doc.select("h2 a[href*='/chuong-']");
    for (var i = 0; i < chapterNodes.size(); i++) {
        var a = chapterNodes.get(i);
        var href = normalizeUrl(a.attr("href"), host);
        if (!href || seen[href]) continue;

        var name = cleanChapterName(a.text() || a.attr("title"));
        if (!name) continue;

        seen[href] = true;
        result.push({
            name: name,
            url: href,
            host: host
        });
        added++;
    }

    // Fallback nhẹ: nếu theme đổi từ h2 sang card/div nhưng vẫn là link /chuong-.
    if (added < 5) {
        var fallbackNodes = doc.select(".entry-content a[href*='/chuong-'], article a[href*='/chuong-']");
        for (var j = 0; j < fallbackNodes.size(); j++) {
            var b = fallbackNodes.get(j);
            var href2 = normalizeUrl(b.attr("href"), host);
            if (!href2 || seen[href2]) continue;

            var name2 = cleanChapterName(b.text() || b.attr("title"));
            if (!name2) continue;

            // Chỉ nhận link có title giống chương, tránh "Đọc Từ Đầu/Chương Mới Nhất".
            if (!/(?:chuong|chương)\s*\d+/i.test(name2)) continue;

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
