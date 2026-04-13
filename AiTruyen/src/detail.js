// detail.js - Lấy thông tin chi tiết truyện trên AiTruyen
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") !== 0) return HOST + link;
    return link;
}

function decodeNextImage(src) {
    if (!src) return "";
    if (src.indexOf("/_next/image") >= 0) {
        var m = src.match(/url=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
    }
    return src;
}

function normalizeCover(src) {
    src = decodeNextImage(src || "");
    if (!src) return "";
    if (src.indexOf("//") === 0) return "https:" + src;
    if (src.indexOf("http") !== 0) return HOST + src;
    return src;
}

function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function execute(url) {
    var slugMatch = (url || "").match(/\/truyen\/([^/?#]+)/i);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;
    var response = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    if (!doc) return null;

    var title = "";
    var cover = "";
    var author = "";
    var genres = "";
    var statusText = "";
    var desc = "";

    // === Ưu tiên 1: Trích từ __next_f RSC scripts (Next.js App Router không có __NEXT_DATA__) ===
    try {
        var scripts = doc.select("script:not([src])");
        for (var rscIdx = 0; rscIdx < scripts.size(); rscIdx++) {
            var rscTxt = scripts.get(rscIdx).html();
            if (!rscTxt || rscTxt.length < 50) continue;
            if (rscTxt.indexOf(slug) < 0) continue;

            // Tìm vị trí slug trong RSC data, rồi scan ~600 ký tự xung quanh để lấy các field
            var posA = rscTxt.indexOf('"slug":"' + slug + '"');
            var posB = rscTxt.indexOf('\\"slug\\":\\"' + slug + '\\"');
            var pos = posA >= 0 ? posA : posB;
            if (pos < 0) continue;

            // Lấy window xung quanh slug để tìm các field liên quan
            var start = Math.max(0, pos - 50);
            var end = Math.min(rscTxt.length, pos + 800);
            var window = rscTxt.substring(start, end);

            // Title của story (gần slug)
            if (!title) {
                var tmA = window.match(/"title":"([^"]{3,200})"/);
                var tmB = window.match(/\\"title\\":\\"([^\\"]{3,200})\\"/);
                var titleRaw = (tmA && tmA[1]) || (tmB && tmB[1]) || "";
                // Bỏ nếu là tiêu đề chương (thường bắt đầu bằng "Chương N" hoặc chứa "•")
                if (titleRaw && !/^Ch[uư]/i.test(titleRaw) && titleRaw.indexOf(" \u2022 ") < 0) {
                    title = titleRaw;
                }
            }

            // Author
            if (!author) {
                var auA = window.match(/"authorName":"([^"]{2,100})"/)
                       || window.match(/"author":\{"name":"([^"]{2,100})"/);
                var auB = window.match(/\\"authorName\\":\\"([^\\"]{2,100})\\"/)
                       || window.match(/\\"author\\":\{\\"name\\":\\"([^\\"]{2,100})\\"/);
                author = (auA && auA[1]) || (auB && auB[1]) || "";
            }

            // Cover từ media.aitruyen.net
            if (!cover) {
                var cvA = window.match(/(https?:\/\/media\.aitruyen\.net\/[^\s"\\]+\.(?:jpg|jpeg|png|webp))/);
                if (!cvA) cvA = rscTxt.match(/(https?:\/\/media\.aitruyen\.net\/[^\s"\\]+\.(?:jpg|jpeg|png|webp))/);
                if (cvA) cover = normalizeCover(cvA[1]);
            }

            // Status
            if (!statusText) {
                var stA = window.match(/"status":"([^"]{2,50})"/)
                       || window.match(/"state":"([^"]{2,50})"/);
                var stB = window.match(/\\"status\\":\\"([^\\"]{2,50})\\"/)
                       || window.match(/\\"state\\":\\"([^\\"]{2,50})\\"/);
                var rawSt = (stA && stA[1]) || (stB && stB[1]) || "";
                if (rawSt) {
                    if (/ongoing|dang|tiep/i.test(rawSt)) statusText = "Còn tiếp";
                    else if (/complet|hoan/i.test(rawSt)) statusText = "Hoàn thành";
                    else statusText = rawSt;
                }
            }

            // Description (lấy ở phạm vi rộng hơn)
            if (!desc) {
                var descWin = rscTxt.substring(start, Math.min(rscTxt.length, pos + 2000));
                var dsA = descWin.match(/"description":"((?:[^"\\]|\\.)*)"/);
                var dsB = descWin.match(/\\"description\\":\\"((?:[^\\"\\\\]|\\\\.)*?)\\"/);
                var rawDesc = (dsA && dsA[1]) || (dsB && dsB[1]) || "";
                desc = normalizeText(rawDesc.replace(/\\n/g, " ").replace(/\\"/g, '"'));
                if (desc.length < 10) desc = "";
            }

            if (title) break; // Đủ thông tin cơ bản, thoát vòng lặp script
        }
    } catch (e) {}


    // === Fallback: Parse từ DOM ===

    // Tiêu đề
    if (!title) {
        var h1 = doc.select("h1").first();
        if (h1) title = normalizeText(h1.text());
    }
    if (!title) title = normalizeText(doc.select("meta[property='og:title']").attr("content"));
    if (!title) title = normalizeText(doc.select("title").text().replace(/[\s\-|]*AI Truy[eệ]n.*/i, ""));
    if (!title) title = decodeURIComponent(slug.replace(/-/g, " "));

    // Cover
    if (!cover) cover = normalizeCover(doc.select("meta[property='og:image']").attr("content"));
    if (!cover) {
        var imgs = doc.select("img");
        for (var i = 0; i < Math.min(imgs.size(), 30); i++) {
            var src = imgs.get(i).attr("src") || imgs.get(i).attr("data-src") || "";
            if (!src) continue;
            src = normalizeCover(src);
            if (!src) continue;
            if (src.indexOf("logo") >= 0 || src.indexOf("icon") >= 0 || src.indexOf("avatar") >= 0) continue;
            if (!cover) cover = src;
            break;
        }
    }

    // Tác giả từ link tim-kiem?author=... (selector trực tiếp, không cần .parent())
    if (!author) {
        var authorLinks = doc.select("a[href*='tim-kiem?author='], a[href*='tim-kiem?author%']");
        if (authorLinks.size() > 0) {
            author = normalizeText(authorLinks.first().text());
        }
    }

    // Thể loại từ link tim-kiem?genre= (nếu trang có)
    if (!genres) {
        var genreLinks = doc.select("a[href*='tim-kiem?genre='], a[href*='/the-loai/']");
        if (genreLinks.size() > 0) {
            var genArr = [];
            for (var gi = 0; gi < genreLinks.size(); gi++) {
                var gt = normalizeText(genreLinks.get(gi).text());
                if (gt && genArr.indexOf(gt) < 0) genArr.push(gt);
            }
            genres = genArr.join(", ");
        }
    }

    // Fallback: tìm pattern "tác giả • thể loại" trong DOM
    if (!author || !genres) {
        var allElements = doc.select("span, p, div");
        for (var ei = 0; ei < Math.min(allElements.size(), 200); ei++) {
            var el = allElements.get(ei);
            var elText = normalizeText(el.text());
            if (!elText || elText.length < 3 || elText.length > 200) continue;
            // Tìm pattern: "text • text"
            var bulletMatch = elText.match(/^([^•\n]{2,60})\s*•\s*([^•\n]{2,80})$/);
            if (bulletMatch) {
                var part1 = normalizeText(bulletMatch[1]);
                var part2 = normalizeText(bulletMatch[2]);
                // Bỏ qua nếu là kiểu "số chương" hay "số xem"
                if (/^\d/.test(part2) || /chương|xem|bình|đánh/i.test(part2)) continue;
                if (!author && part1 && part1.length > 1) author = part1;
                if (!genres && part2 && part2.length > 1) genres = part2;
                if (author && genres) break;
            }
        }
    }

    // Thể loại từ links thể loại
    if (!genres) {
        var chips = doc.select("a[href*='/the-loai/'], a[href*='/genre/'], a[href*='/tag/']");
        if (chips.size() > 0) {
            var arr = [];
            for (var c = 0; c < chips.size(); c++) {
                var t = normalizeText(chips.get(c).text());
                if (t && arr.indexOf(t) < 0) arr.push(t);
            }
            genres = arr.join(", ");
        }
    }

    // Trạng thái
    if (!statusText) {
        var pageText = doc.text() || "";
        var stMatch = pageText.match(/\b(Còn\s*tiếp|Hoàn\s*thành|Đang\s*ra|Đang cập nhật)\b/i);
        if (stMatch) statusText = normalizeText(stMatch[1]);
    }

    // Mô tả từ og:description hoặc p đầu tiên đủ dài
    if (!desc) desc = normalizeText(doc.select("meta[property='og:description']").attr("content"));
    if (!desc) desc = normalizeText(doc.select("meta[name='description']").attr("content"));
    if (!desc || /^Nền tảng truyện thông minh/i.test(desc)) {
        var ps = doc.select("p");
        for (var p = 0; p < ps.size(); p++) {
            var pt = normalizeText(ps.get(p).text());
            if (!pt || pt.length < 40) continue;
            if (/^(Nền tảng truyện thông minh|Lối vào chính|Yêu cầu gỡ truyện|Bỏ qua điều hướng)/i.test(pt)) continue;
            desc = pt;
            break;
        }
    }
    if (!desc) desc = title;

    // Build thông tin
    var infoLines = [];
    if (author) infoLines.push(author);
    if (genres) infoLines.push(genres);
    if (statusText) infoLines.push(statusText);

    // Xác định ongoing
    var isOngoing = true;
    if (statusText) {
        isOngoing = !/ho[àa]n|complete[d]?|finished/i.test(statusText);
    }

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
