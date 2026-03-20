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

function normalizeNameKey(name) {
    var n = (name || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!n) return "";

    // Ưu tiên key theo số chương để loại các bản trùng URL khác nhau ở trang cuối.
    var m = n.match(/^(?:chương|chuong)\s*(\d+)/i);
    if (m) return "c:" + m[1];

    if (/^(?:ngoại\s*truyện|ngoai\s*truyen)/i.test(n)) {
        return "e:" + n.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    }

    return "t:" + n.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
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

function htmlDecode(s) {
    if (!s) return "";
    return s
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#8211;/g, "-")
        .replace(/&#8212;/g, "-")
        .replace(/&#8230;/g, "...")
        .replace(/&#(\d+);/g, function (_, num) {
            var code = parseInt(num, 10);
            return isNaN(code) ? _ : String.fromCharCode(code);
        });
}

function extractChapterSectionHtml(pageHtml) {
    if (!pageHtml) return "";
    // Bám đúng thẻ heading chứa "Danh sách chương" để tránh match nhầm text ở script/footer.
    var headingRe = /<h[1-6][^>]*>[\s\S]*?danh\s*(?:sá|sa)ch\s*ch(?:ươ|uo)ng[\s\S]*?<\/h[1-6]>/i;
    var hm = headingRe.exec(pageHtml);
    if (!hm) return "";

    // Chỉ giữ phần sau heading Danh sách chương.
    var start = hm.index + hm[0].length;
    var segment = pageHtml.substring(start);
    var segmentLower = segment.toLowerCase();

    // Cắt tại phân trang hoặc cuối article/content để tránh ăn footer/menu.
    var cutCandidates = [
        segmentLower.indexOf("page-numbers"),
        segmentLower.indexOf("class=\"pagination"),
        segmentLower.indexOf("class='pagination"),
        segmentLower.indexOf("</article>"),
        segmentLower.indexOf("</main>"),
        segmentLower.indexOf("copyright")
    ];

    var cut = segment.length;
    for (var i = 0; i < cutCandidates.length; i++) {
        var idx = cutCandidates[i];
        if (idx > 0 && idx < cut) cut = idx;
    }

    return segment.substring(0, cut);
}

function collectChaptersFromHtml(sectionHtml, result, seen, seenName, host) {
    var added = 0;
    if (!sectionHtml) return 0;

    // Lấy đúng box chương theo thứ tự xuất hiện trong DOM (trái -> phải, trên -> dưới).
    var re = /<h2[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi;
    var m;
    while ((m = re.exec(sectionHtml)) !== null) {
        var href = normalizeUrl((m[1] || "").trim(), host);
        var rawName = (m[2] || "").replace(/<[^>]*>/g, " ");
        var name = cleanChapterName(htmlDecode(rawName).replace(/\s+/g, " ").trim());
        var nameKey = normalizeNameKey(name);

        if (!href || seen[href]) continue;
        if (shouldSkipAnchor(name, href)) continue;
        if (nameKey && seenName[nameKey]) continue;
        if (!name) continue;

        seen[href] = true;
        if (nameKey) seenName[nameKey] = true;
        result.push({
            name: name,
            url: href,
            host: host
        });
        added++;
    }

    return added;
}

function collectChapters(doc, result, seen, seenName, host) {
    var pageHtml = doc.html() || "";
    var sectionHtml = extractChapterSectionHtml(pageHtml);
    var added = collectChaptersFromHtml(sectionHtml, result, seen, seenName, host);

    if (added > 0) return added;

    // Fallback chặt: chỉ giữ các tiêu đề chapter-like để tránh lẫn block khác.
    var nodes = doc.select(".entry-content h2 a[href], article h2 a[href]");
    for (var i = 0; i < nodes.size(); i++) {
        var a = nodes.get(i);
        var href = normalizeUrl(a.attr("href"), host);
        var name = cleanChapterName(a.text() || a.attr("title"));
        var nameKey = normalizeNameKey(name);
        if (!href || seen[href]) continue;
        if (shouldSkipAnchor(name, href)) continue;
        if (!/^(?:chương|chuong|ngoại\s*truyện|ngoai\s*truyen|phần|phan|quyển|quyen)\b/i.test(name)) continue;
        if (nameKey && seenName[nameKey]) continue;
        if (!name) continue;

        seen[href] = true;
        if (nameKey) seenName[nameKey] = true;
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
    var seenName = {};
    collectChapters(doc, data, seen, seenName, host);

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
            var fAdded = collectChapters(fd, data, seen, seenName, host);
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
        collectChapters(d, data, seen, seenName, host);
    }

    return Response.success(data);
}
