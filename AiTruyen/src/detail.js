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

    // === Ưu tiên 1: Lấy từ __NEXT_DATA__ JSON ===
    try {
        var nextDataEl = doc.select("script#__NEXT_DATA__").first();
        if (nextDataEl) {
            var nextJson = nextDataEl.html();
            if (nextJson && nextJson.length > 10) {
                var nd = JSON.parse(nextJson);
                var pp = nd && nd.props && nd.props.pageProps;
                if (pp) {
                    // story object thường ở pp.story hoặc pp.data
                    var story = pp.story || pp.data || pp.item || null;
                    if (story && typeof story === "object" && !story.length) {
                        title = story.title || story.name || "";
                        author = "";
                        if (story.author) {
                            if (typeof story.author === "string") {
                                author = story.author;
                            } else if (story.author.name) {
                                author = story.author.name;
                            } else if (story.author.username) {
                                author = story.author.username;
                            }
                        }
                        if (!author && story.authorName) author = story.authorName;
                        if (!author && story.translator) author = story.translator;

                        // Cover
                        var rawCover = story.cover || story.thumbnail || story.image || story.coverUrl || story.coverImage || "";
                        if (rawCover) cover = normalizeCover(rawCover);

                        // Status
                        statusText = story.status || story.state || "";
                        if (statusText === "ongoing") statusText = "Còn tiếp";
                        else if (statusText === "completed") statusText = "Hoàn thành";

                        // Genres/Categories
                        var cats = story.categories || story.genres || story.tags || [];
                        if (cats && cats.length > 0) {
                            var genArr = [];
                            for (var ci = 0; ci < cats.length; ci++) {
                                var cat = cats[ci];
                                var catName = typeof cat === "string" ? cat : (cat.name || cat.title || "");
                                if (catName && genArr.indexOf(catName) < 0) genArr.push(catName);
                            }
                            genres = genArr.join(", ");
                        }

                        // Description
                        desc = story.description || story.summary || story.synopsis || "";
                        desc = normalizeText(desc);
                    }
                }
            }
        }
    } catch (e) {
        // JSON parse thất bại, tiếp tục fallback
    }

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

    // Tác giả và thể loại: Trên trang aitruyen.net, hiển thị dạng "Tên tác giả • Thể loại"
    // Pattern này xuất hiện trong các thẻ text gần tiêu đề truyện
    if (!author || !genres) {
        // Tìm pattern "tác giả • thể loại" trong DOM
        // Các thẻ span/p chứa bullet separator
        var allElements = doc.select("span, p, div");
        for (var ei = 0; ei < Math.min(allElements.size(), 200); ei++) {
            var el = allElements.get(ei);
            var elText = normalizeText(el.text());
            // Bỏ qua elements quá dài (là description) hoặc quá ngắn
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
