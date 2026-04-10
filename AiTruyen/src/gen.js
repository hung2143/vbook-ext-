// gen.js - Lấy danh sách truyện từ trang chủ / danh mục AiTruyen
var HOST = "https://aitruyen.net";

function execute(url, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

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

    var pageHtml = doc.html() || "";

    // === Phương pháp 1: Parse __NEXT_DATA__ JSON (ưu tiên, nhanh & chính xác) ===
    try {
        var nextDataEl = doc.select("script#__NEXT_DATA__").first();
        if (nextDataEl) {
            var nextJson = nextDataEl.html();
            if (nextJson && nextJson.length > 10) {
                var nd = JSON.parse(nextJson);
                var pageProps = nd && nd.props && nd.props.pageProps;
                if (pageProps) {
                    // Tìm mảng stories trong pageProps (cấu trúc có thể thay đổi)
                    var stories = pageProps.stories || pageProps.data || pageProps.items
                        || pageProps.novels || pageProps.results || [];

                    // Nếu stories nằm trong object .data
                    if (!stories.length && pageProps.data && pageProps.data.stories) {
                        stories = pageProps.data.stories;
                    }
                    if (!stories.length && pageProps.data && pageProps.data.items) {
                        stories = pageProps.data.items;
                    }

                    // Thử tìm trong các key khác
                    if (!stories.length) {
                        var keys = Object.keys(pageProps);
                        for (var ki = 0; ki < keys.length; ki++) {
                            var val = pageProps[keys[ki]];
                            if (val && typeof val === "object" && val.length > 0) {
                                // Kiểm tra xem phần tử đầu có slug/title không
                                var first = val[0];
                                if (first && (first.slug || first.title || first.name)) {
                                    stories = val;
                                    break;
                                }
                            }
                            // Kiểm tra nested data
                            if (val && typeof val === "object" && !val.length) {
                                var subKeys = Object.keys(val);
                                for (var si = 0; si < subKeys.length; si++) {
                                    var subVal = val[subKeys[si]];
                                    if (subVal && typeof subVal === "object" && subVal.length > 0) {
                                        var subFirst = subVal[0];
                                        if (subFirst && (subFirst.slug || subFirst.title || subFirst.name)) {
                                            stories = subVal;
                                            break;
                                        }
                                    }
                                }
                                if (stories.length > 0) break;
                            }
                        }
                    }

                    if (stories && stories.length > 0) {
                        for (var si = 0; si < stories.length; si++) {
                            var s = stories[si];
                            var sSlug = s.slug || s.id || "";
                            var sName = s.title || s.name || sSlug;
                            if (!sName) continue;
                            var sLink = sSlug ? (HOST + "/truyen/" + sSlug) : "";
                            if (s.url) sLink = normalizeUrl(s.url);
                            if (!sLink) continue;

                            var sCover = s.cover || s.thumbnail || s.image || "";
                            if (sCover && !sCover.startsWith("http")) sCover = normalizeUrl(sCover);
                            sCover = decodeNextImage(sCover);

                            var sDesc = s.description || s.summary || "";
                            pushNovel(sLink, sName, sCover, sDesc);
                        }

                        if (data.length > 0) {
                            // Kiểm tra next page
                            var hasNext = pageProps.hasNext || pageProps.has_next
                                || (pageProps.totalPages && pageNum < pageProps.totalPages)
                                || (pageProps.pagination && pageNum < pageProps.pagination.totalPages);
                            // Fallback: nếu danh sách đủ lớn, giả sử có trang tiếp
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

    // === Phương pháp 2: DOM scraping (an toàn hơn, tránh .parent() crash) ===
    var anchors = doc.select("a[href*='/truyen/']");
    for (var k = 0; k < anchors.size(); k++) {
        var a = anchors.get(k);
        var href = normalizeUrl(a.attr("href") || "");
        if (!href || href.indexOf("/truyen/") < 0) continue;
        if (href.indexOf("/chuong-") >= 0) continue;

        // Lấy tên
        var aName = "";
        var h3 = a.select("h3").first();
        if (h3) aName = h3.text();
        if (!aName) {
            var h2 = a.select("h2").first();
            if (h2) aName = h2.text();
        }
        if (!aName) aName = a.attr("aria-label") || "";
        if (!aName) aName = a.attr("title") || "";
        if (!aName) aName = a.text();
        if (!aName) {
            var slug = href.split("/").filter(function(s) { return s; }).pop();
            aName = decodeURIComponent((slug || "").replace(/-/g, " "));
        }
        aName = (aName || "").replace(/\s+/g, " ").trim();
        if (!aName) continue;

        // Lấy cover từ img con
        var cover = "";
        var img = a.select("img").first();
        if (!img) {
            // An toàn: thử lấy parent, bọc try-catch
            try {
                var parentEl = a.parent();
                if (parentEl) img = parentEl.select("img").first();
            } catch (e) {
                // parent() không hỗ trợ cho element này, bỏ qua
            }
        }
        if (img) {
            cover = img.attr("src") || img.attr("data-src") || "";
            cover = decodeNextImage(cover);
            if (cover && !cover.startsWith("http")) cover = normalizeUrl(cover);
        }

        // Lấy mô tả ngắn - bọc try-catch
        var desc = "";
        try {
            var parentNode = a.parent();
            if (parentNode) {
                var ps = parentNode.select("p");
                for (var pi = 0; pi < ps.size(); pi++) {
                    var pText = ps.get(pi).text().trim();
                    if (pText && pText.length > 15) { desc = pText; break; }
                }
            }
        } catch (e) {
            // Bỏ qua nếu parent() lỗi
        }

        pushNovel(href, aName, cover, desc);
    }

    // Kiểm tra trang tiếp theo
    var nextPage = null;
    if (data.length > 0) {
        var hasNextLink = doc.select("a[href*='page=" + (pageNum + 1) + "']").size() > 0
            || doc.select("a[aria-label='Next'], a[rel='next'], a[aria-label='Trang sau']").size() > 0;
        if (hasNextLink) nextPage = (pageNum + 1).toString();
        // Fallback: nếu có nhiều truyện, giả sử có trang tiếp
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
