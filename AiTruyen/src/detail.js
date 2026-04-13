// detail.js - Lấy thông tin chi tiết truyện trên AiTruyen
// Chiến lược: OG meta tags (luôn có trong SSR HTML) là nguồn chính,
// sau đó fallback sang DOM selectors và RSC script data.
// Tham khảo pattern đơn giản của tiemtruyenchu: fetch + selectors trực tiếp.
var HOST = "https://aitruyen.net";

function normalizeCover(src) {
    if (!src) return "";
    // Xử lý Next.js Image Optimization URLs
    if (src.indexOf("/_next/image") >= 0) {
        var m = src.match(/url=([^&]+)/);
        if (m) src = decodeURIComponent(m[1]);
    }
    if (src.indexOf("//") === 0) return "https:" + src;
    if (src.indexOf("http") !== 0) return HOST + src;
    return src;
}

function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function execute(url) {
    // Lấy slug từ URL (xử lý cả URL trang truyện lẫn URL chương)
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var response = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    if (!doc) return null;

    // ===== Bước 1: OG meta tags — luôn có trong SSR HTML của Next.js =====
    // (giống cách tiemtruyenchu dùng selectors trực tiếp)
    var title = normalizeText(doc.select("meta[property='og:title']").attr("content"))
                    .replace(/\s*\|\s*AI Truy[eệ]n\s*$/i, "")
                    .replace(/^\d+\s*[•\-]\s*/i, "")   // bỏ "1 • " ở đầu chương
                    .replace(/\s*-\s*[A-Z][^\-]{3,50}\s*$/g, "") // bỏ "- Nô Lệ Bóng Tối" trong og chương
                    .trim();

    var cover = normalizeCover(doc.select("meta[property='og:image']").attr("content"));
    var desc = normalizeText(doc.select("meta[property='og:description']").attr("content"));
    if (!desc) desc = normalizeText(doc.select("meta[name='description']").attr("content"));

    var author = "";
    var genres = "";
    var statusText = "";

    // ===== Bước 2: DOM selectors — tác giả, thể loại từ các link =====
    var authorLinks = doc.select("a[href*='tim-kiem?author='], a[href*='tim-kiem?author%']");
    if (authorLinks.size() > 0) {
        author = normalizeText(authorLinks.first().text());
    }

    var genreLinks = doc.select("a[href*='tim-kiem?genre='], a[href*='/the-loai/']");
    if (genreLinks.size() > 0) {
        var genArr = [];
        for (var gi = 0; gi < genreLinks.size(); gi++) {
            var gt = normalizeText(genreLinks.get(gi).text());
            if (gt && genArr.indexOf(gt) < 0) genArr.push(gt);
        }
        genres = genArr.join(", ");
    }

    // ===== Bước 3: Fallback từ RSC __next_f scripts cho những field còn thiếu =====
    if (!title || !cover || !author) {
        try {
            var scripts = doc.select("script:not([src])");
            for (var si = 0; si < scripts.size(); si++) {
                var stxt = scripts.get(si).html();
                if (!stxt || stxt.length < 50) continue;

                // Title: tìm gần slug hoặc từ "title" field
                if (!title) {
                    var posA = stxt.indexOf('"slug":"' + slug + '"');
                    var posB = stxt.indexOf('\\"slug\\":\\"' + slug + '\\"');
                    var pos = posA >= 0 ? posA : posB;
                    if (pos >= 0) {
                        var win = stxt.substring(Math.max(0, pos - 50), Math.min(stxt.length, pos + 400));
                        var tmA = win.match(/"title":"([^"]{3,200})"/);
                        var tmB = win.match(/\\"title\\":\\"([^\\"]{3,200})\\"/);
                        var titleRaw = (tmA && tmA[1]) || (tmB && tmB[1]) || "";
                        if (titleRaw && !/^Ch[uư]/i.test(titleRaw) && titleRaw.indexOf("\u2022") < 0) {
                            title = titleRaw;
                        }
                    }
                }

                // Author từ authorName
                if (!author) {
                    var auA = stxt.match(/"authorName":"([^"]{2,100})"/);
                    var auB = stxt.match(/\\"authorName\\":\\"([^\\"]{2,100})\\"/);
                    if (auA || auB) author = (auA && auA[1]) || (auB && auB[1]);
                }

                // Cover từ domain media.aitruyen.net
                if (!cover) {
                    var cvA = stxt.match(/(https?:\/\/media\.aitruyen\.net\/[^\s"'\\?]+\.(?:jpg|jpeg|png|webp))/);
                    if (cvA) cover = normalizeCover(cvA[1]);
                }

                // Status
                if (!statusText) {
                    var stA = stxt.match(/"status":"(ongoing|completed|[^"]{2,30})"/) ||
                              stxt.match(/\\"status\\":\\"(ongoing|completed|[^\\"]{2,30})\\"/);
                    if (stA) {
                        var rawSt = stA[1];
                        if (/ongoing|dang|tiep/i.test(rawSt)) statusText = "Còn tiếp";
                        else if (/complet|hoan/i.test(rawSt)) statusText = "Hoàn thành";
                    }
                }

                if (title && cover && author) break;
            }
        } catch (e) {}
    }

    // ===== Bước 4: Fallback cuối — h1, img, text =====
    if (!title) {
        var h1Els = doc.select("h1");
        if (h1Els.size() > 0) title = normalizeText(h1Els.first().text());
    }
    if (!title) {
        var pageTitle = doc.select("title").text();
        title = normalizeText(pageTitle).replace(/\s*\|\s*AI Truy[eệ]n\s*$/i, "").trim();
    }
    if (!title) title = slug.replace(/-/g, " ");

    if (!cover) {
        var imgs = doc.select("img");
        for (var i = 0; i < Math.min(imgs.size(), 30); i++) {
            var src = imgs.get(i).attr("src") || imgs.get(i).attr("data-src") || "";
            if (!src) continue;
            src = normalizeCover(src);
            if (!src) continue;
            if (src.indexOf("logo") >= 0 || src.indexOf("icon") >= 0 || src.indexOf("avatar") >= 0) continue;
            cover = src;
            break;
        }
    }

    if (!desc) desc = title;

    // Trạng thái từ text trang nếu chưa có
    if (!statusText) {
        var stMatch = (doc.text() || "").match(/\b(Còn\s*tiếp|Hoàn\s*thành|Đang\s*ra|Đang cập nhật)\b/i);
        if (stMatch) statusText = normalizeText(stMatch[1]);
    }

    var infoLines = [];
    if (author) infoLines.push(author);
    if (genres) infoLines.push(genres);
    if (statusText) infoLines.push(statusText);

    var isOngoing = !statusText || !/ho[àa]n|complete[d]?|finished/i.test(statusText);

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc,
        detail: infoLines.join("\n"),
        ongoing: isOngoing,
        host: HOST
    });
}
