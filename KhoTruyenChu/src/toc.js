var HOST = "https://khotruyenchu.click";

function normalizeHost(url) {
    if (!url) return url;
    return url.replace(/https?:\/\/(www\.)?khotruyenchu\.[^/]+/i, HOST);
}

function normalizeUrl(href) {
    if (!href) return "";
    if (href.startsWith("//")) return "https:" + href;
    if (href.startsWith("/")) return HOST + href;
    if (!href.startsWith("http")) return HOST + "/" + href;
    return href;
}

function stripHtml(s) {
    return (s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Lấy term ID của bo_truyen từ slug
function getTermId(slug) {
    var apiUrl = HOST + "/wp-json/wp/v2/bo_truyen?slug=" + encodeURIComponent(slug);
    var resp = fetch(apiUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!resp.ok) return null;
    try {
        var terms = resp.json();
        if (terms && terms.length > 0) return terms[0].id;
    } catch (e) {}
    return null;
}

// Lấy toàn bộ chương qua WP REST API — nhanh nhất
function fetchChaptersApi(termId) {
    var result = [];
    var seen = {};
    var page = 1;
    var perPage = 100;

    while (true) {
        var apiUrl = HOST + "/wp-json/wp/v2/posts?bo_truyen=" + termId
            + "&per_page=" + perPage
            + "&page=" + page
            + "&orderby=date&order=asc"
            + "&_fields=id,title,slug,link,date";
        var resp = fetch(apiUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": HOST + "/"
            }
        });
        if (!resp.ok) break;

        var posts;
        try {
            posts = resp.json();
        } catch (e) { break; }

        if (!posts || posts.length === 0) break;

        for (var i = 0; i < posts.length; i++) {
            var ch = posts[i];
            var chapUrl = normalizeUrl(ch.link || ("/" + ch.slug + "/"));
            if (!chapUrl || seen[chapUrl]) continue;
            var chapName = stripHtml((ch.title && (ch.title.rendered || ch.title)) || ch.slug || "");
            if (!chapName) continue;
            seen[chapUrl] = true;
            result.push({
                name: chapName,
                url: chapUrl,
                host: HOST
            });
        }

        if (posts.length < perPage) break;
        page++;

        // An toàn: tối đa 50 trang (5000 chương)
        if (page > 50) break;
    }

    return result;
}

// === Fallback: HTML scraping ===
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
    if (/^(?:mục\s*lục|muc\s*luc|báo\s*lỗi|bao\s*loi|ủng\s*hộ|ung\s*ho|giao\s*diện|giao\s*dien|chương\s*trước|chuong\s*truoc|chương\s*sau|chuong\s*sau)$/i.test(n)) return true;
    if (/^(?:danh\s*sách\s*chương|cập\s*nhật)$/i.test(n)) return true;
    return false;
}

function collectChaptersHtml(doc) {
    var result = [];
    var seen = {};
    var pageHtml = doc.html() || "";

    // Tìm vùng danh sách chương
    var headingRe = /<h[1-6][^>]*>[\s\S]*?danh\s*(?:sá|sa)ch\s*ch(?:ươ|uo)ng[\s\S]*?<\/h[1-6]>/i;
    var hm = headingRe.exec(pageHtml);
    var sectionHtml = "";
    if (hm) {
        var start = hm.index + hm[0].length;
        var segment = pageHtml.substring(start);
        var segLower = segment.toLowerCase();
        var cutCandidates = [
            segLower.indexOf("page-numbers"),
            segLower.indexOf("class=\"pagination"),
            segLower.indexOf("</article>"),
            segLower.indexOf("</main>"),
            segLower.indexOf("copyright")
        ];
        var cut = segment.length;
        for (var i = 0; i < cutCandidates.length; i++) {
            if (cutCandidates[i] > 0 && cutCandidates[i] < cut) cut = cutCandidates[i];
        }
        sectionHtml = segment.substring(0, cut);
    }

    if (sectionHtml) {
        var re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        var m;
        while ((m = re.exec(sectionHtml)) !== null) {
            var href = normalizeUrl((m[1] || "").trim());
            var rawName = (m[2] || "").replace(/<[^>]*>/g, " ");
            var name = cleanChapterName(stripHtml(rawName));
            if (!href || seen[href]) continue;
            if (shouldSkipAnchor(name, href)) continue;
            if (!name) continue;
            seen[href] = true;
            result.push({ name: name, url: href, host: HOST });
        }
    }

    // Fallback: dùng DOM selector
    if (result.length === 0) {
        var nodes = doc.select(".entry-content h2 a[href], article h2 a[href], .entry-content a[href]");
        for (var j = 0; j < nodes.size(); j++) {
            var a = nodes.get(j);
            var aHref = normalizeUrl(a.attr("href"));
            var aName = cleanChapterName(a.text() || a.attr("title"));
            if (!aHref || seen[aHref]) continue;
            if (shouldSkipAnchor(aName, aHref)) continue;
            if (!aName) continue;
            seen[aHref] = true;
            result.push({ name: aName, url: aHref, host: HOST });
        }
    }

    return result;
}

function execute(url) {
    url = normalizeHost(url);

    // Trích slug truyện từ URL
    var slugMatch = url.match(/\/truyen\/([^/?#]+)/);
    var slug = slugMatch ? slugMatch[1] : "";

    // === Ưu tiên WP REST API — nhanh hơn N lần so với HTML scraping ===
    if (slug) {
        var termId = getTermId(slug);
        if (termId) {
            var chapters = fetchChaptersApi(termId);
            if (chapters && chapters.length > 0) {
                return Response.success(chapters);
            }
        }
    }

    // === Fallback: HTML scraping (phòng trường hợp API bị chặn) ===
    var base = url;
    if (!base.endsWith('/')) base += '/';
    base = base.replace(/\/page\/\d+\/$/, '');
    if (!base.endsWith('/')) base += '/';

    var response = fetch(base, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var data = collectChaptersHtml(doc);

    // Thử thêm các trang phân trang nếu cần
    var lastPage = 1;
    var pageNodes = doc.select("a.page-numbers, span.page-numbers");
    for (var p = 0; p < pageNodes.size(); p++) {
        var txt = (pageNodes.get(p).text() || "").replace(/\s+/g, "").trim();
        if (/^\d+$/.test(txt)) {
            var pNum = parseInt(txt, 10);
            if (pNum > lastPage) lastPage = pNum;
        }
    }

    for (var pg = 2; pg <= lastPage; pg++) {
        var pgUrl = base + "page/" + pg + "/";
        var pgResp = fetch(pgUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": base
            }
        });
        if (!pgResp.ok) continue;
        var pgDoc = pgResp.html("utf-8");
        var pgChaps = collectChaptersHtml(pgDoc);
        for (var ci = 0; ci < pgChaps.length; ci++) {
            data.push(pgChaps[ci]);
        }
    }

    return Response.success(data);
}
