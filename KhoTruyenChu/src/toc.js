function collectChapters(doc, seen, host) {
    var list = [];
    var nodes = doc.select("a[href*='/chuong']");
    for (var i = 0; i < nodes.size(); i++) {
        var a = nodes.get(i);
        var href = a.attr('href');
        if (!href) continue;
        if (!href.startsWith('http')) href = host + href;
        if (seen[href]) continue;
        seen[href] = true;

        var name = a.text();
        if (!name) name = a.attr('title');
        if (!name) {
            var slug = href.split('/').filter(Boolean).pop();
            name = decodeURIComponent(slug.replace(/-/g, ' '));
        }
        list.push({
            name: name,
            url: href,
            host: host
        });
    }
    return list;
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
    var seen = {};
    var data = collectChapters(doc, seen, host);

    // Lấy số trang mục lục (nếu có /page/2/ ...)
    var maxPage = 1;
    var pageLinks = doc.select("a[href*='/page/']");
    for (var p = 0; p < pageLinks.size(); p++) {
        var a = pageLinks.get(p);
        var href = a.attr('href');
        if (!href) continue;
        var m = href.match(/\/page\/(\d+)\//);
        if (m) {
            var n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxPage) maxPage = n;
        }
    }

    var base = url;
    if (!base.endsWith('/')) base += '/';
    base = base.replace(/\/page\/\d+\/$/, '');
    if (!base.endsWith('/')) base += '/';

    // Quét toàn bộ phân trang chương, để không bị thiếu chương khi truyện dài.
    // Đặt giới hạn an toàn cao để tránh vòng lặp quá lớn nếu site lỗi phân trang.
    var limit = Math.min(maxPage, 200);
    for (var i = 2; i <= limit; i++) {
        var pageUrl = base + "page/" + i + "/";
        var r = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": url
            }
        });
        if (!r.ok) continue;
        var d = r.html("utf-8");
        var before = data.length;
        data = data.concat(collectChapters(d, seen, host));

        // Nếu trang phân trang không còn chương mới thì có thể đã tới cuối.
        if (data.length === before && i > maxPage) break;
    }

    return Response.success(data);
}
