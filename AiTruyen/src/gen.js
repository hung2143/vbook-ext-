// gen.js - Lấy danh sách truyện từ trang chủ / danh mục AiTruyen
var HOST = "https://aitruyen.net";

function execute(url, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    function normalizeUrl(link) {
        if (!link) return "";
        if (link.indexOf("//") === 0) return "https:" + link;
        if (link.indexOf("http") !== 0) return HOST + link;
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

    function normalizeCover(src) {
        if (!src) return "";
        src = decodeNextImage(src);
        if (src.indexOf("//") === 0) return "https:" + src;
        if (src.indexOf("http") !== 0) return HOST + src;
        return src;
    }

    var data = [];
    var seen = {};

    function pushNovel(link, name, cover, desc) {
        if (!link) return;
        if (link.indexOf("/truyen/") < 0) return;
        // Bỏ qua link chương
        if (link.indexOf("/chuong-") >= 0) return;
        var m = link.match(/^(https?:\/\/[^/]+\/truyen\/[^/?#]+)/);
        var canonLink = m ? m[1] : link;
        if (seen[canonLink]) return;
        seen[canonLink] = true;
        data.push({
            name: name,
            link: canonLink,
            cover: cover || "",
            description: desc || "",
            host: HOST
        });
    }

    // Tạo URL danh sách
    var listUrl = url + pageNum;
    if (listUrl.indexOf("page=") < 0) {
        listUrl = HOST + "/?page=" + pageNum;
    }

    var response = fetch(listUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) {
        return Response.success([{
            name: "AiTruyen: fetch lỗi",
            link: listUrl,
            cover: "",
            description: "HTTP " + response.status,
            host: HOST
        }], null);
    }

    var doc = response.html("utf-8");
    if (!doc) {
        return Response.success([{
            name: "AiTruyen: không parse được HTML",
            link: listUrl,
            cover: "",
            description: "",
            host: HOST
        }], null);
    }

    // === Phương pháp 1: Parse __NEXT_DATA__ JSON ===
    try {
        var nextDataEl = doc.select("script#__NEXT_DATA__").first();
        if (nextDataEl) {
            var nextJson = nextDataEl.html();
            if (nextJson && nextJson.length > 10) {
                var nd = JSON.parse(nextJson);
                var pageProps = nd && nd.props && nd.props.pageProps;
                if (pageProps) {
                    var stories = null;
                    var tryKeys = ["stories", "data", "items", "novels", "results",
                        "latestStories", "hotStories", "completedStories",
                        "recentStories", "popularStories"];

                    for (var ti = 0; ti < tryKeys.length; ti++) {
                        var val = pageProps[tryKeys[ti]];
                        if (val && typeof val === "object" && val.length > 0) {
                            var first = val[0];
                            if (first && (first.slug || first.title || first.name)) {
                                stories = val;
                                break;
                            }
                        }
                    }

                    if (!stories) {
                        var keys = Object.keys(pageProps);
                        for (var ki = 0; ki < keys.length; ki++) {
                            var kval = pageProps[keys[ki]];
                            if (kval && typeof kval === "object" && kval.length > 0) {
                                var kfirst = kval[0];
                                if (kfirst && (kfirst.slug || kfirst.title || kfirst.name)) {
                                    stories = kval;
                                    break;
                                }
                            }
                            if (kval && typeof kval === "object" && !kval.length) {
                                var subKeys = Object.keys(kval);
                                for (var si = 0; si < subKeys.length; si++) {
                                    var subVal = kval[subKeys[si]];
                                    if (subVal && typeof subVal === "object" && subVal.length > 0) {
                                        var subFirst = subVal[0];
                                        if (subFirst && (subFirst.slug || subFirst.title || subFirst.name)) {
                                            stories = subVal;
                                            break;
                                        }
                                    }
                                }
                                if (stories) break;
                            }
                        }
                    }

                    if (stories && stories.length > 0) {
                        for (var si2 = 0; si2 < stories.length; si2++) {
                            var s = stories[si2];
                            var sSlug = s.slug || s.id || "";
                            var sName = s.title || s.name || sSlug;
                            if (!sName) continue;
                            var sLink = sSlug ? (HOST + "/truyen/" + sSlug) : "";
                            if (s.url) sLink = normalizeUrl(s.url);
                            if (!sLink) continue;

                            var sCover = s.cover || s.thumbnail || s.image || s.coverUrl || "";
                            sCover = normalizeCover(sCover);

                            var sDesc = s.description || s.summary || "";
                            pushNovel(sLink, sName, sCover, sDesc);
                        }

                        if (data.length > 0) {
                            var hasNext = pageProps.hasNext || pageProps.has_next
                                || (pageProps.totalPages && pageNum < pageProps.totalPages)
                                || (pageProps.pagination && pageNum < pageProps.pagination.totalPages);
                            if (!hasNext && stories.length >= 10) hasNext = true;
                            return Response.success(data, hasNext ? (pageNum + 1).toString() : null);
                        }
                    }
                }
            }
        }
    } catch (e) {
        // __NEXT_DATA__ parse thất bại, fallback sang DOM
    }

    // === Phương pháp 2: DOM scraping ===
    // Cấu trúc trang AiTruyen: mỗi truyện là một card gồm
    //   <a href="/truyen/slug">...ảnh bìa...</a>
    //   <h3>Tên truyện</h3>
    //   Tác giả • Thể loại
    //   <a href="/truyen/slug">Mở truyện</a>
    //   <a href="/truyen/slug/chuong-xxx">Chương mới</a>
    //
    // Chiến lược: tìm các thẻ h3 có nội dung, lấy link từ thẻ cha (card container)

    // Thử lấy tên truyện từ h3 trước, bỏ qua bối cảnh "Mở truyện"
    var allH3 = doc.select("h3");
    for (var hi = 0; hi < allH3.size(); hi++) {
        var h3 = allH3.get(hi);
        var h3Text = (h3.text() || "").trim();
        if (!h3Text || h3Text.length < 2) continue;
        // Bỏ qua các tiêu đề section
        if (/^(Truyện mới|Truyện hot|Truyện hoàn|Chương mới|Bảng xếp|Gợi ý|Có thể)/i.test(h3Text)) continue;

        // Tìm link truyện gần h3 nhất (cha, ông... hoặc anh em)
        var cardLink = "";
        var cardCover = "";
        var cardDesc = "";

        // Tìm trong cha: parent, grandparent của h3
        var parent = h3.parent();
        var tries = 0;
        while (parent && tries < 5) {
            // Tìm link /truyen/ trong parent
            var candidateLinks = parent.select("a[href*='/truyen/']");
            for (var ci = 0; ci < candidateLinks.size(); ci++) {
                var cLinkHref = candidateLinks.get(ci).attr("href") || "";
                // Bỏ qua link chương
                if (cLinkHref.indexOf("/chuong-") >= 0) continue;
                var cLinkText = (candidateLinks.get(ci).text() || "").trim();
                // Bỏ qua nút "Mở truyện", "Vào trang truyện" vì ta muốn link card
                // nhưng vẫn dùng url của nó
                if (cLinkHref.indexOf("/truyen/") >= 0) {
                    cardLink = normalizeUrl(cLinkHref);
                    break;
                }
            }
            if (cardLink) {
                // Tìm ảnh cover trong parent
                var imgs = parent.select("img");
                for (var ii = 0; ii < imgs.size(); ii++) {
                    var imgSrc = imgs.get(ii).attr("src") || imgs.get(ii).attr("data-src") || "";
                    imgSrc = normalizeCover(imgSrc);
                    if (imgSrc && imgSrc.indexOf("data:") < 0) {
                        cardCover = imgSrc;
                        break;
                    }
                }
                // Tìm description từ p
                var ps = parent.select("p");
                for (var pi = 0; pi < ps.size(); pi++) {
                    var pText = (ps.get(pi).text() || "").trim();
                    if (pText && pText.length > 15) { cardDesc = pText; break; }
                }
                break;
            }
            parent = parent.parent();
            tries++;
        }

        if (!cardLink) continue;
        pushNovel(cardLink, h3Text, cardCover, cardDesc);
    }

    // Fallback: nếu h3 không hiệu quả, lấy từ links anchor đến /truyen/
    if (data.length === 0) {
        var anchors = doc.select("a[href*='/truyen/']");
        for (var k = 0; k < anchors.size(); k++) {
            var a = anchors.get(k);
            var href = normalizeUrl(a.attr("href") || "");
            if (!href || href.indexOf("/truyen/") < 0) continue;
            if (href.indexOf("/chuong-") >= 0) continue;

            // Bỏ qua các nút lệnh
            var aText = (a.text() || "").trim();
            if (/^(Mở truyện|Chương mới|Vào trang truyện|Đọc chương mới|Xem bảng|Xem toàn bộ|Đọc từ đầu|Vào chương)$/i.test(aText)) continue;

            // Lấy tên từ h3 bên trong
            var aName = "";
            var innerH3 = a.select("h3").first();
            if (innerH3) aName = innerH3.text().trim();
            if (!aName) {
                var innerH2 = a.select("h2").first();
                if (innerH2) aName = innerH2.text().trim();
            }
            if (!aName) aName = a.attr("aria-label") || a.attr("title") || "";

            if (!aName && aText && aText.length > 3 && aText.length < 150 && !/^[\d\s•]+$/.test(aText)) {
                aName = aText.split("\n")[0].trim();
            }

            if (!aName) {
                var slug2 = href.replace(/^.*\/truyen\//, "").split("/")[0];
                aName = decodeURIComponent((slug2 || "").replace(/-/g, " "));
            }
            aName = (aName || "").replace(/\s+/g, " ").trim();
            if (!aName || aName.length < 2) continue;
            if (/^\d+$/.test(aName)) continue;

            // Lấy cover
            var cover = "";
            var img = a.select("img").first();
            if (img) {
                cover = img.attr("src") || img.attr("data-src") || "";
                cover = normalizeCover(cover);
            }

            pushNovel(href, aName, cover, "");
        }
    }

    // Kiểm tra trang tiếp theo
    var nextPage = null;
    if (data.length > 0) {
        var hasNextLink = doc.select("a[href*='page=" + (pageNum + 1) + "']").size() > 0
            || doc.select("a[aria-label='Next'], a[rel='next'], a[aria-label='Trang sau']").size() > 0;
        if (hasNextLink) nextPage = (pageNum + 1).toString();
        if (!nextPage && data.length >= 10) nextPage = (pageNum + 1).toString();
    }

    if (data.length === 0) {
        data.push({
            name: "AiTruyen: không tìm thấy truyện",
            link: listUrl,
            cover: "",
            description: "Trang " + pageNum,
            host: HOST
        });
    }

    return Response.success(data, nextPage);
}
