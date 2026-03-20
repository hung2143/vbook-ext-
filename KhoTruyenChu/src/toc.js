function normalizeUrl(href, host) {
    if (!href) return "";
    if (!href.startsWith("http")) return host + href;
    return href;
}

function chapterNoFrom(name, href) {
    var text = (name || "").toLowerCase();
    var m = text.match(/(?:chuong|chương)\s*0*(\d+)/i);
    if (m) return parseInt(m[1], 10);

    var url = (href || "").toLowerCase();
    var m2 = url.match(/\/chuong-0*(\d+)[-\/]/i);
    if (m2) return parseInt(m2[1], 10);

    return -1;
}

function stripTags(text) {
    return (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function upsertChapter(resultByNo, no, name, href, host) {
    if (no < 1) return;
    if (!resultByNo[no]) {
        resultByNo[no] = {
            name: name,
            url: href,
            host: host,
            __no: no
        };
        return;
    }

    // Ưu tiên tiêu đề bắt đầu bằng "Chương <số>" để khớp format danh sách chương.
    var preferred = new RegExp("^\\s*(?:chuong|chương)\\s*0*" + no + "\\b", "i");
    var oldName = resultByNo[no].name || "";
    var oldPreferred = preferred.test(oldName);
    var newPreferred = preferred.test(name || "");
    if (!oldPreferred && newPreferred) {
        resultByNo[no] = {
            name: name,
            url: href,
            host: host,
            __no: no
        };
    }
}

function collectChapters(doc, resultByNo, host) {
    var html = doc.html() || "";
    var sectionCount = 0;

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
            var name = stripTags(m[2]);
            var no = chapterNoFrom(name, href);
            if (no < 1) continue;
            upsertChapter(resultByNo, no, name, href, host);
            sectionCount++;
        }
    }

    // Fallback bằng selector DOM nếu parse theo section không đủ dữ liệu.
    if (sectionCount < 5) {
        var nodes = doc.select("a[href*='/chuong']");
        for (var i = 0; i < nodes.size(); i++) {
            var a = nodes.get(i);
            var href2 = normalizeUrl(a.attr("href"), host);
            if (!href2) continue;

            var name2 = a.text();
            if (!name2) name2 = a.attr("title");
            name2 = (name2 || "").replace(/\s+/g, " ").trim();
            if (!name2) continue;

            var no2 = chapterNoFrom(name2, href2);
            if (no2 < 1) continue;
            upsertChapter(resultByNo, no2, name2, href2, host);
        }
    }
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
    var byNo = {};
    collectChapters(doc, byNo, host);

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
        var before = Object.keys(byNo).length;
        collectChapters(d, byNo, host);
        var after = Object.keys(byNo).length;

        // Nếu trang phân trang không còn chương mới thì có thể đã tới cuối.
        if (after === before && i > maxPage) break;
    }

    var data = [];
    var keys = Object.keys(byNo);
    for (var k = 0; k < keys.length; k++) {
        data.push(byNo[keys[k]]);
    }

    // Sắp xếp từ Chương 1 tới chương cuối để app hiển thị đúng thứ tự đọc.
    data.sort(function (a, b) {
        if (a.__no === b.__no) return a.url > b.url ? 1 : -1;
        return a.__no - b.__no;
    });

    for (var x = 0; x < data.length; x++) {
        if (x === 0 && /đọc\s*từ\s*đầu/i.test(data[x].name || "")) {
            // Nếu mục đầu bị gán nhãn "Đọc Từ Đầu", đổi về tên chương 1 thật.
            try {
                var r1 = fetch(data[x].url, {
                    headers: {
                        "user-agent": UserAgent.chrome(),
                        "referer": host + "/"
                    }
                });
                if (r1.ok) {
                    var d1 = r1.html("utf-8");
                    var chapTitle = d1.select("h1, h2, .entry-title").first();
                    var chapName = chapTitle ? chapTitle.text() : "";
                    chapName = (chapName || "").replace(/\s+/g, " ").trim();
                    if (chapName) data[x].name = chapName;
                    else data[x].name = "Chương 1";
                } else {
                    data[x].name = "Chương 1";
                }
            } catch (ignore) {
                data[x].name = "Chương 1";
            }
        }
        delete data[x].__no;
    }

    return Response.success(data);
}
