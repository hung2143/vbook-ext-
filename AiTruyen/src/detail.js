// detail.js - Lấy thông tin chi tiết một truyện trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]
var HOST = "https://aitruyen.net";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.startsWith("//")) return "https:" + link;
    if (!link.startsWith("http")) return HOST + link;
    return link;
}

function decodeNextImage(src) {
    if (!src) return "";
    if (src.indexOf("/_next/image") >= 0) {
        var urlParam = src.match(/url=([^&]+)/);
        if (urlParam) return decodeURIComponent(urlParam[1]);
    }
    return src;
}

function stripHtml(s) {
    return (s || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ").trim();
}

function execute(url) {
    // Trích slug từ URL
    var slugMatch = url.match(/\/truyen\/([^/?#]+)/);
    if (!slugMatch) return null;
    var slug = slugMatch[1];

    var storyUrl = HOST + "/truyen/" + slug;

    // === Lấy trang HTML truyện ===
    var response = fetch(storyUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    if (!doc) return null;
    var pageHtml = doc.html() || "";

    // === Ưu tiên lấy từ __NEXT_DATA__ ===
    var title = "";
    var cover = "";
    var desc = "";
    var author = "";
    var statusText = "";
    var genres = "";

    try {
        var nextDataEl = doc.select("script#__NEXT_DATA__").first();
        if (nextDataEl) {
            var nextJson = nextDataEl.html();
            if (nextJson && nextJson.length > 10) {
                var nd = JSON.parse(nextJson);
                var pageProps = nd && nd.props && nd.props.pageProps;
                if (pageProps) {
                    // Tìm object story trong pageProps
                    var story = pageProps.story || pageProps.data || pageProps.novel || pageProps.book || null;

                    // Nếu không có key trực tiếp, tìm object có title/name
                    if (!story) {
                        var ppKeys = Object.keys(pageProps);
                        for (var ki = 0; ki < ppKeys.length; ki++) {
                            var val = pageProps[ppKeys[ki]];
                            if (val && typeof val === "object" && !val.length && (val.title || val.name) && (val.slug || val.id)) {
                                story = val;
                                break;
                            }
                        }
                    }

                    if (story) {
                        title = story.title || story.name || "";
                        cover = story.cover || story.thumbnail || story.image || story.coverUrl || "";
                        if (cover && !cover.startsWith("http")) cover = normalizeUrl(cover);
                        cover = decodeNextImage(cover);

                        desc = story.description || story.summary || story.synopsis || "";
                        author = story.author || "";
                        if (!author && story.authors && story.authors.length > 0) {
                            author = story.authors[0].name || story.authors[0];
                        }
                        if (typeof author === "object") author = author.name || "";

                        statusText = story.status || story.state || "";

                        if (story.genres && story.genres.length > 0) {
                            var genreArr = [];
                            for (var gi = 0; gi < story.genres.length; gi++) {
                                var g = story.genres[gi];
                                genreArr.push(typeof g === "string" ? g : (g.name || g.title || ""));
                            }
                            genres = genreArr.filter(function(s) { return s; }).join(", ");
                        } else if (story.categories && story.categories.length > 0) {
                            var catArr = [];
                            for (var ci = 0; ci < story.categories.length; ci++) {
                                var c = story.categories[ci];
                                catArr.push(typeof c === "string" ? c : (c.name || c.title || ""));
                            }
                            genres = catArr.filter(function(s) { return s; }).join(", ");
                        }
                    }
                }
            }
        }
    } catch (e) { /* fallback to HTML */ }

    // === Fallback HTML: Tiêu đề ===
    if (!title) {
        var h1 = doc.select("h1").first();
        if (h1) title = h1.text().trim();
        if (!title) title = doc.select("title").text().replace(/[\s\-|]*AI Truy[eệ]n.*/i, "").trim();
        if (!title) title = decodeURIComponent(slug.replace(/-/g, " "));
    }

    // === Fallback HTML: Cover ===
    if (!cover) {
        // og:image
        var ogImage = doc.select("meta[property='og:image']").attr("content");
        if (ogImage) cover = normalizeUrl(ogImage);
    }
    if (!cover) {
        // Tìm img đầu tiên gần h1 hoặc trong phần header
        var allImgs = doc.select("img");
        for (var ii = 0; ii < Math.min(allImgs.size(), 15); ii++) {
            var imgEl = allImgs.get(ii);
            var imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || "";
            // Bỏ qua icon nhỏ, logo
            if (!imgSrc) continue;
            if (imgSrc.indexOf("logo") >= 0) continue;
            if (imgSrc.indexOf("icon") >= 0) continue;
            if (imgSrc.indexOf("avatar") >= 0) continue;
            // Chấp nhận ảnh có kích thước hợp lý (cover truyện)
            imgSrc = decodeNextImage(imgSrc);
            if (imgSrc) {
                cover = normalizeUrl(imgSrc);
                break;
            }
        }
    }

    // === Fallback HTML: Mô tả ===
    if (!desc) {
        desc = doc.select("meta[property='og:description']").attr("content");
    }
    if (!desc) {
        desc = doc.select("meta[name='description']").attr("content") || "";
    }
    // Lấy nội dung giới thiệu từ DOM - tìm phần "Giới thiệu"
    if (!desc) {
        // Trên AiTruyen, nội dung giới thiệu nằm sau text "Giới thiệu"
        var allPs = doc.select("p");
        var foundIntro = false;
        var descParts = [];
        for (var pi = 0; pi < allPs.size(); pi++) {
            var pEl = allPs.get(pi);
            var pText = (pEl.text() || "").trim();
            if (!pText) continue;
            if (pText === "Giới thiệu") {
                foundIntro = true;
                continue;
            }
            if (foundIntro && pText.length > 20) {
                descParts.push(pText);
                if (descParts.length >= 5) break;
            }
            if (foundIntro && /^(Danh sách chương|Cộng đồng|Đánh giá|Bình luận)$/i.test(pText)) break;
        }
        if (descParts.length > 0) desc = descParts.join("\n");
    }
    desc = (desc || "").replace(/\s+/g, " ").trim();
    if (!desc) desc = title;

    // === Fallback HTML: Tác giả ===
    if (!author) {
        var metaOgAuthor = doc.select("meta[name='author']").attr("content");
        if (metaOgAuthor) author = metaOgAuthor.trim();
    }
    if (!author) {
        var ldMatch = pageHtml.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
        if (ldMatch) author = ldMatch[1];
    }
    if (!author) {
        // AiTruyen hiển thị tên tác giả ngay dưới tiêu đề truyện
        // Thường là text nhỏ trước phần giới thiệu
        var spans = doc.select("span");
        for (var si = 0; si < Math.min(spans.size(), 20); si++) {
            var sp = spans.get(si);
            var spClass = sp.attr("class") || "";
            if (spClass.indexOf("ink-soft") >= 0 || spClass.indexOf("text-xs") >= 0) {
                var spText = sp.text().trim();
                if (spText && spText.length > 1 && spText.length < 60 && !/^(Còn|Hoàn|Chương|Chapter)/i.test(spText)) {
                    author = spText;
                    break;
                }
            }
        }
    }

    // === Fallback HTML: Trạng thái ===
    if (!statusText) {
        var statusMatch = pageHtml.match(/(Còn\s*tiếp|Hoàn\s*thành|Đang ra)/i);
        if (statusMatch) statusText = statusMatch[1].trim();
    }

    // === Fallback HTML: Thể loại ===
    if (!genres) {
        var genreLinks = doc.select("a[href*='/the-loai/'], a[href*='/genre/']");
        if (genreLinks.size() > 0) {
            var genreArr = [];
            for (var gi = 0; gi < genreLinks.size(); gi++) {
                genreArr.push(genreLinks.get(gi).text().trim());
            }
            if (genreArr.length > 0) genres = genreArr.join(", ");
        }
    }

    var infoLines = [];
    if (author) infoLines.push("Tác giả: " + author);
    if (genres) infoLines.push("Thể loại: " + genres);
    if (statusText) infoLines.push("Trạng thái: " + statusText);

    var isOngoing = statusText ? !/ho[àa]n|complete|finished/i.test(statusText) : true;

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc,
        detail: infoLines.join("<br>"),
        ongoing: isOngoing,
        host: HOST
    });
}
