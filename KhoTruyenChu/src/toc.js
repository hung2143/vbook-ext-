function normalizeUrl(href, host) {
    if (!href) return "";
    if (!href.startsWith("http")) return host + href;
    return href;
}

function chapterNoFrom(name, href) {
    var text = (name || "").toLowerCase();
    var m = text.match(/chuong\s*0*(\d+)/i);
    if (m) return parseInt(m[1], 10);

    var url = (href || "").toLowerCase();
    var m2 = url.match(/\/chuong-0*(\d+)[-\/]/i);
    if (m2) return parseInt(m2[1], 10);

    return -1;
}

function collectChapters(doc, seen, host) {
    var list = [];
    var nodes = doc.select("a[href*='/chuong']");
    for (var i = 0; i < nodes.size(); i++) {
        var a = nodes.get(i);
        var href = normalizeUrl(a.attr("href"), host);
        if (!href) continue;

        var name = a.text();
        if (!name) name = a.attr("title");
        name = (name || "").replace(/\s+/g, " ").trim();
        if (!name) continue;

        // Chỉ lấy chapter thật, bỏ các link điều hướng như "Chương Mới Nhất".
        var no = chapterNoFrom(name, href);
        if (no < 1) continue;

        if (seen[href]) continue;
        seen[href] = true;

        list.push({
            name: name,
            url: href,
            host: host,
            __no: no
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

    // Sắp xếp từ Chương 1 tới chương cuối để app hiển thị đúng thứ tự đọc.
    data.sort(function (a, b) {
        if (a.__no === b.__no) return a.url > b.url ? 1 : -1;
        return a.__no - b.__no;
    });

    for (var x = 0; x < data.length; x++) {
        delete data[x].__no;
    }

    return Response.success(data);
}
