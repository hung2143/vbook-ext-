function normalizeUrl(href, host) {
    if (!href) return "";
    if (href.startsWith("//")) return "https:" + href;
    if (href.startsWith("/")) return host + href;
    if (!href.startsWith("http")) return host + "/" + href;
    return href;
}

function cleanChapterName(name) {
    var n = (name || "").replace(/\s+/g, " ").trim();
    if (/^đọc\s*từ\s*đầu$/i.test(n)) return "";
    if (/^chương\s*mới\s*nhất$/i.test(n)) return "";
    return n;
}

function shouldSkipAnchor(name, href) {
    var n = (name || "").toLowerCase();
    var u = (href || "").toLowerCase();

    if (!n || !u) return true;
    if (u.indexOf("#") >= 0) return true;
    if (u.indexOf("/page/") >= 0) return true;
    if (u.indexOf("/truyen/") >= 0) return true;

    if (/^(?:\d+|trang\s*\d+|sau|trước|truoc|prev|next)$/i.test(n)) return true;
    if (/^(?:mục\s*lục|muc\s*luc|lịch\s*sử|lich\s*su|báo\s*lỗi|bao\s*loi|ủng\s*hộ|ung\s*ho|giao\s*diện|giao\s*dien|chương\s*trước|chuong\s*truoc|chương\s*sau|chuong\s*sau)$/i.test(n)) return true;
    if (/^(?:danh\s*sách\s*chương|danh\s*sach\s*chuong|chương\s*mới\s*cập\s*nhật|chuong\s*moi\s*cap\s*nhat)$/i.test(n)) return true;

    return false;
}

function collectChapters(doc, result, seen, host) {
    var added = 0;

    // Lấy chapter box từ khu vực danh sách chương.
    // Không ép pattern /chuong- để không bỏ sót ngoại truyện.
    var chapterNodes = doc.select(".entry-content h2 a[href], article h2 a[href], h2 a[href]");
    for (var i = 0; i < chapterNodes.size(); i++) {
        var a = chapterNodes.get(i);
        var href = normalizeUrl(a.attr("href"), host);
        if (!href || seen[href]) continue;

        var name = cleanChapterName(a.text() || a.attr("title"));
        if (shouldSkipAnchor(name, href)) continue;
        if (!name) continue;

        seen[href] = true;
        result.push({
            name: name,
            url: href,
            host: host
        });
        added++;
    }

    return added;
}

function detectLastPage(doc) {
    var last = 1;
    var pageNodes = doc.select("a.page-numbers, span.page-numbers");
    for (var i = 0; i < pageNodes.size(); i++) {
        var txt = (pageNodes.get(i).text() || "").replace(/\s+/g, "").trim();
        if (!/^\d+$/.test(txt)) continue;
        var p = parseInt(txt, 10);
        if (p > last) last = p;
    }
    return last;
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

    // Ưu tiên lấy đúng trang cuối từ paginator của box Danh sách chương.
    var lastPage = detectLastPage(doc);

    if (lastPage <= 1) {
        // Fallback nếu paginator không hiện đủ: quét dần đến khi hết chương.
        for (var f = 2; f <= 2000; f++) {
            var fallbackPageUrl = base + "page/" + f + "/";
            var fr = fetch(fallbackPageUrl, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": url
                }
            });
            if (!fr.ok) break;
            var fd = fr.html("utf-8");
            var fAdded = collectChapters(fd, data, seen, host);
            if (fAdded === 0) break;
        }
        return Response.success(data);
    }

    // Quét lần lượt từ trang 2 tới trang cuối, đảm bảo không sót box chương.
    for (var i = 2; i <= lastPage; i++) {
        var pageUrl = base + "page/" + i + "/";
        var r = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": url
            }
        });
        if (!r.ok) continue;
        var d = r.html("utf-8");
        collectChapters(d, data, seen, host);
    }

    return Response.success(data);
}
