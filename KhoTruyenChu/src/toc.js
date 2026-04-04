var HOST = "https://khotruyenchu.click";

function normalizeHost(url) {
    if (!url) return url;
    // Thay bất kỳ domain khotruyenchu.* nào bằng HOST hiện tại
    return url.replace(/https?:\/\/(www\.)?khotruyenchu\.[^/]+/i, HOST);
}

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

function collectChaptersFromHtml(sectionHtml, result, seen, host) {
    var added = 0;
    if (!sectionHtml) return 0;

    // Lấy tất cả anchor trong section để không rớt các mục không có tiền tố "Chương".
    var re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(sectionHtml)) !== null) {
        var href = normalizeUrl((m[1] || "").trim(), host);
        var rawName = (m[2] || "").replace(/<[^>]*>/g, " ");
        var name = cleanChapterName(htmlDecode(rawName).replace(/\s+/g, " ").trim());

        if (!href || seen[href]) continue;
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

function collectChapters(doc, result, seen, host) {
    var pageHtml = doc.html() || "";
    var sectionHtml = extractChapterSectionHtml(pageHtml);
    var added = collectChaptersFromHtml(sectionHtml, result, seen, host);

    if (added > 0) return added;

    // Fallback: ưu tiên h2 anchor trong nội dung.
    var nodes = doc.select(".entry-content h2 a[href], article h2 a[href]");
    for (var i = 0; i < nodes.size(); i++) {
        var a = nodes.get(i);
        var href = normalizeUrl(a.attr("href"), host);
        var name = cleanChapterName(a.text() || a.attr("title"));
        if (!href || seen[href]) continue;
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

function extractPostId(html) {
    // WordPress thêm class postid-{n} vào <body>
    var m = (html || "").match(/\bpostid-(\d+)\b/);
    if (m) return m[1];
    // Fallback: <article id="post-{n}">
    m = (html || "").match(/<article[^>]+\bid="post-(\d+)"/i);
    if (m) return m[1];
    return null;
}

// Thử lấy danh sách chương qua WP REST API (nhanh hơn nhiều so với HTML scraping).
// Trả về array chapter hoặc null nếu API không hoạt động.
function fetchChaptersViaApi(postId, host) {
    var result = [];
    var seen = {};
    // Các post type phổ biến cho chương truyện trên WordPress
    var types = ["chuong", "chapter", "novel_chapter", "chapters"];
    for (var t = 0; t < types.length; t++) {
        var type = types[t];
        var testUrl = host + "/wp-json/wp/v2/" + type + "?parent=" + postId
            + "&per_page=100&page=1&orderby=menu_order&order=asc&_fields=id,title,slug,link";
        var r = fetch(testUrl, {
            headers: { "user-agent": UserAgent.chrome(), "referer": host + "/" }
        });
        if (!r.ok) continue;
        try {
            var firstPage = r.json();
            if (!firstPage || firstPage.length === 0) continue;

            // API này hoạt động - lấy tất cả trang
            var page = 1;
            var batch = firstPage;
            while (batch && batch.length > 0) {
                for (var i = 0; i < batch.length; i++) {
                    var ch = batch[i];
                    var chapUrl = normalizeUrl(ch.link || (host + "/" + ch.slug + "/"), host);
                    if (!chapUrl || seen[chapUrl]) continue;
                    var chapName = (ch.title && (ch.title.rendered || ch.title)) || ch.slug || "";
                    chapName = chapName.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                    if (!chapName) continue;
                    seen[chapUrl] = true;
                    result.push({ name: chapName, url: chapUrl, host: host });
                }
                if (batch.length < 100) break;
                page++;
                var nextUrl = host + "/wp-json/wp/v2/" + type + "?parent=" + postId
                    + "&per_page=100&page=" + page + "&orderby=menu_order&order=asc&_fields=id,title,slug,link";
                var nr = fetch(nextUrl, {
                    headers: { "user-agent": UserAgent.chrome(), "referer": host + "/" }
                });
                if (!nr.ok) break;
                batch = nr.json();
            }
            if (result.length > 0) return result;
        } catch (e) { continue; }
    }
    return null;
}

function execute(url) {
    url = normalizeHost(url);
    var host = HOST;
    var base = url;
    if (!base.endsWith('/')) base += '/';
    base = base.replace(/\/page\/\d+\/$/, '');
    if (!base.endsWith('/')) base += '/';

    var firstPageUrl = base;

    var response = fetch(firstPageUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": host + "/"
        }
    });

    if (!response.ok && firstPageUrl !== url) {
        response = fetch(url, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": host + "/"
            }
        });
    }

    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var pageHtml = doc.html() || "";

    // --- Thử WP REST API trước để tránh N serial HTML page fetches ---
    var postId = extractPostId(pageHtml);
    if (postId) {
        var apiChapters = fetchChaptersViaApi(postId, host);
        if (apiChapters && apiChapters.length > 0) {
            return Response.success(apiChapters);
        }
    }

    // --- Fallback: HTML scraping theo trang ---
    var data = [];
    var seen = {};
    collectChapters(doc, data, seen, host);

    var lastPage = detectLastPage(doc);

    if (lastPage <= 1) {
        var emptyStreak = 0;
        for (var f = 2; f <= 120; f++) {
            var fallbackPageUrl = base + "page/" + f + "/";
            var fr = fetch(fallbackPageUrl, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": firstPageUrl
                }
            });
            if (!fr.ok) break;
            var fd = fr.html("utf-8");
            var fAdded = collectChapters(fd, data, seen, host);
            if (fAdded === 0) {
                emptyStreak++;
                if (emptyStreak >= 2) break;
            } else {
                emptyStreak = 0;
            }
        }
        return Response.success(data);
    }

    for (var i = 2; i <= lastPage; i++) {
        var pageUrl = base + "page/" + i + "/";
        var r = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": firstPageUrl
            }
        });
        if (!r.ok) continue;
        var d = r.html("utf-8");
        collectChapters(d, data, seen, host);
    }

    return Response.success(data);
}
