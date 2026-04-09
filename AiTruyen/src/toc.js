// toc.js - Lấy danh sách chương (Table of Contents) của một truyện trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.startsWith("//")) return "https:" + link;
    if (!link.startsWith("http")) return HOST + link;
    return link;
}

function execute(url) {
    // Trích slug truyện
    var slugMatch = url.match(/\/truyen\/([^/?#]+)/);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var result = [];
    var seen = {};

    // === Thử API tìm danh sách chương ===
    // AiTruyen có thể expose API kiểu /api/stories/[slug]/chapters hoặc /api/chapters?story=[slug]
    var apiTries = [
        HOST + "/api/stories/" + encodeURIComponent(slug) + "/chapters?page=1&limit=1000&sort=asc",
        HOST + "/api/stories/" + encodeURIComponent(slug) + "/chapters?orderby=asc",
        HOST + "/api/chapters?story=" + encodeURIComponent(slug) + "&page=1&limit=500"
    ];

    for (var ai = 0; ai < apiTries.length; ai++) {
        var apiResp = fetch(apiTries[ai], {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": storyUrl,
                "accept": "application/json"
            }
        });
        if (!apiResp.ok) continue;
        try {
            var json = apiResp.json();
            var chapters = json.data || json.chapters || json.items || json.results || [];
            if (chapters && chapters.length > 0) {
                for (var ci = 0; ci < chapters.length; ci++) {
                    var ch = chapters[ci];
                    // Xây dựng URL chương
                    var chapSlug = ch.slug || ("chuong-" + (ch.number || ch.chapterNumber || ch.index || ci + 1));
                    var chapUrl = storyUrl + "/" + chapSlug;
                    if (ch.url) chapUrl = normalizeUrl(ch.url);
                    var chapName = ch.title || ch.name || ("Chương " + (ch.number || ci + 1));
                    if (seen[chapUrl]) continue;
                    seen[chapUrl] = true;
                    result.push({
                        name: chapName,
                        url: chapUrl,
                        host: HOST
                    });
                }
                if (result.length > 0) return Response.success(result);
            }
        } catch (e) { /* thử tiếp */ }
    }

    // === Fallback: HTML scraping - lấy danh sách chương từ trang truyện ===
    // AiTruyen dùng Next.js, danh sách chương có thể phân trang
    // Thử lấy tất cả chương qua phân trang HTML

    function fetchChaptersFromPage(pageUrl) {
        var resp = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": HOST + "/"
            }
        });
        if (!resp.ok) return [];

        var doc = resp.html("utf-8");
        var pageResult = [];

        // Lấy tất cả link chương: href="/truyen/slug/chuong-N"
        var chapAnchors = doc.select("a[href*='/chuong-']");
        for (var ci = 0; ci < chapAnchors.size(); ci++) {
            var a = chapAnchors.get(ci);
            var href = a.attr("href") || "";
            if (!href) continue;
            // Kiểm tra đúng slug truyện
            if (href.indexOf("/truyen/" + slug + "/") < 0) continue;
            var chapUrl = normalizeUrl(href);
            if (seen[chapUrl]) continue;

            // Tên chương: ưu tiên thẻ p hoặc span bên trong, hoặc text của thẻ a
            var chapName = "";
            var pEl = a.select("p, span").first();
            if (pEl) chapName = pEl.text().trim();
            if (!chapName) chapName = a.text().trim();
            if (!chapName) {
                // Trích số chương từ URL
                var numMatch = href.match(/chuong-(\d+)/);
                chapName = numMatch ? "Chương " + numMatch[1] : href;
            }
            chapName = chapName.replace(/\s+/g, " ").trim();

            seen[chapUrl] = true;
            pageResult.push({
                name: chapName,
                url: chapUrl,
                host: HOST
            });
        }

        return pageResult;
    }

    // Lấy trang đầu tiên
    var page1Chapters = fetchChaptersFromPage(storyUrl);
    for (var i = 0; i < page1Chapters.length; i++) {
        result.push(page1Chapters[i]);
    }

    // Kiểm tra xem có phân trang chương không
    // AiTruyen thường có nút phân trang cho danh sách chương nếu > 50 chương
    var resp1 = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (resp1.ok) {
        var doc1 = resp1.html("utf-8");
        var pageHtml = doc1.html() || "";

        // Tìm tổng số trang chương
        // Tìm số trang qua URL /truyen/slug?page=N hoặc các nút phân trang
        var maxPage = 1;
        var pageLinks = doc1.select("a[href*='?page='], a[href*='&page=']");
        for (var pl = 0; pl < pageLinks.size(); pl++) {
            var plHref = pageLinks.get(pl).attr("href") || "";
            var pMatch = plHref.match(/page=(\d+)/);
            if (pMatch) {
                var pNum = parseInt(pMatch[1], 10);
                if (pNum > maxPage) maxPage = pNum;
            }
        }

        // Nếu có nhiều trang, lấy từ trang 2 trở đi
        for (var pg = 2; pg <= maxPage; pg++) {
            var pgUrl = storyUrl + "?page=" + pg;
            var pgChapters = fetchChaptersFromPage(pgUrl);
            for (var pi = 0; pi < pgChapters.length; pi++) {
                result.push(pgChapters[pi]);
            }
            // Giới hạn an toàn
            if (pg > 100) break;
        }
    }

    // Sắp xếp theo số chương tăng dần (phòng trường hợp trang hiển thị ngược)
    result.sort(function(a, b) {
        var numA = parseInt((a.url.match(/chuong-(\d+)/) || [0, 0])[1], 10);
        var numB = parseInt((b.url.match(/chuong-(\d+)/) || [0, 0])[1], 10);
        return numA - numB;
    });

    return Response.success(result);
}
