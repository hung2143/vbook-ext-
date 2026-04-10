// toc.js - Lấy danh sách chương (Table of Contents) của một truyện trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]
// Phân trang chương dùng: ?chapterPage=N&chapterOrder=asc#danh-sach-chuong
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

    // Hàm scrape danh sách chương từ HTML của một trang
    function scrapeChaptersFromDoc(doc) {
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

            // Tên chương: ưu tiên text trực tiếp chứa "Chương"
            var chapName = "";
            // Tìm trong thẻ p hoặc span bên trong anchor
            var innerEls = a.select("p, span, div");
            for (var ie = 0; ie < innerEls.size(); ie++) {
                var innerText = innerEls.get(ie).text().trim();
                if (innerText && innerText.indexOf("Chương") >= 0) {
                    chapName = innerText;
                    break;
                }
            }
            if (!chapName) {
                // Fallback: text của anchor
                var fullText = a.text().trim();
                // Text thường chứa: "115Chương 115: Lão nhân gia lễ vật07/03/2026•1.9K chữ..."
                // Tách ra: bỏ số đầu, giữ phần "Chương N: ..."
                var chapMatch = fullText.match(/(Chương\s+\d+[^•]*)/);
                if (chapMatch) {
                    chapName = chapMatch[1].trim();
                    // Loại bỏ phần ngày tháng cuối nếu có
                    chapName = chapName.replace(/\d{2}\/\d{2}\/\d{4}.*$/, "").trim();
                } else {
                    chapName = fullText;
                }
            }
            if (!chapName) {
                var numMatch = href.match(/chuong-(\d+)/);
                chapName = numMatch ? "Chương " + numMatch[1] : href;
            }
            chapName = chapName.replace(/\s+/g, " ").trim();
            // Loại bỏ nếu chỉ là số hoặc quá ngắn
            if (!chapName || chapName.length < 2) continue;

            seen[chapUrl] = true;
            pageResult.push({
                name: chapName,
                url: chapUrl,
                host: HOST
            });
        }
        return pageResult;
    }

    // Hàm fetch và scrape một trang chương
    function fetchChapterPage(pageNum) {
        var pageUrl;
        if (pageNum <= 1) {
            pageUrl = storyUrl + "?chapterOrder=asc#danh-sach-chuong";
        } else {
            pageUrl = storyUrl + "?chapterPage=" + pageNum + "&chapterOrder=asc#danh-sach-chuong";
        }

        var resp = fetch(pageUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": storyUrl
            }
        });
        if (!resp.ok) return [];

        var doc = resp.html("utf-8");
        if (!doc) return [];
        return scrapeChaptersFromDoc(doc);
    }

    // === Bước 1: Fetch trang đầu tiên (sắp xếp từ cũ nhất) ===
    var firstPageUrl = storyUrl + "?chapterOrder=asc#danh-sach-chuong";
    var firstResp = fetch(firstPageUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (!firstResp.ok) return Response.success([]);

    var firstDoc = firstResp.html("utf-8");
    if (!firstDoc) return Response.success([]);

    // Lấy chương từ trang 1
    var page1Chapters = scrapeChaptersFromDoc(firstDoc);
    for (var i = 0; i < page1Chapters.length; i++) {
        result.push(page1Chapters[i]);
    }

    // === Bước 2: Tìm tổng số trang chương ===
    var maxPage = 1;
    // Tìm các link phân trang chương: ?chapterPage=N
    var pageLinks = firstDoc.select("a[href*='chapterPage=']");
    for (var pl = 0; pl < pageLinks.size(); pl++) {
        var plHref = pageLinks.get(pl).attr("href") || "";
        var pMatch = plHref.match(/chapterPage=(\d+)/);
        if (pMatch) {
            var pNum = parseInt(pMatch[1], 10);
            if (pNum > maxPage) maxPage = pNum;
        }
    }

    // Cũng thử tìm từ text "Đang xem X - Y trong tổng Z chương"
    var pageHtml = firstDoc.html() || "";
    var totalMatch = pageHtml.match(/trong tổng\s+([\d.,]+K?)\s*chương/i);
    if (totalMatch && maxPage <= 1) {
        var totalStr = totalMatch[1].replace(/\./g, "").replace(",", ".");
        var totalChapters = 0;
        if (totalStr.indexOf("K") >= 0) {
            totalChapters = Math.ceil(parseFloat(totalStr.replace("K", "")) * 1000);
        } else {
            totalChapters = parseInt(totalStr, 10);
        }
        if (totalChapters > 0 && page1Chapters.length > 0) {
            maxPage = Math.ceil(totalChapters / page1Chapters.length);
        }
    }

    // === Bước 3: Fetch các trang còn lại ===
    for (var pg = 2; pg <= maxPage; pg++) {
        var pgChapters = fetchChapterPage(pg);
        for (var pi = 0; pi < pgChapters.length; pi++) {
            result.push(pgChapters[pi]);
        }
        // Nếu trang trả về 0 kết quả, dừng lại
        if (pgChapters.length === 0) break;
        // Giới hạn an toàn 500 trang (tối đa ~12000 chương)
        if (pg > 500) break;
    }

    // Sắp xếp theo số chương tăng dần
    result.sort(function(a, b) {
        var numA = parseInt((a.url.match(/chuong-(\d+)/) || [0, 0])[1], 10);
        var numB = parseInt((b.url.match(/chuong-(\d+)/) || [0, 0])[1], 10);
        return numA - numB;
    });

    return Response.success(result);
}
