function collectChapters(doc, seen, host) {
    var list = [];
    var nodes = doc.select("a[href*='/chuong']");
    nodes.forEach(function (a) {
        var href = a.attr('href');
        if (!href) return;
        if (!href.startsWith('http')) href = host + href;
        if (seen[href]) return;
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
    });
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
    doc.select("a[href*='/page/']").forEach(function (a) {
        var href = a.attr('href');
        var m = href.match(/\/page\/(\d+)\//);
        if (m) {
            var n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxPage) maxPage = n;
        }
    });

    var base = url;
    if (!base.endsWith('/')) base += '/';
    base = base.replace(/\/page\/\d+\/$/, '');
    if (!base.endsWith('/')) base += '/';

    var limit = Math.min(maxPage, 5); // tránh lặp quá nhiều
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
        data = data.concat(collectChapters(d, seen, host));
    }

    return Response.success(data);
}
