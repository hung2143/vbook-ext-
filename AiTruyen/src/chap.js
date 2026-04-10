// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// QUAN TRỌNG: AiTruyen yêu cầu đăng nhập để đọc nội dung chương.
// Nội dung chương được render bằng JavaScript phía client (Next.js).
// Người dùng cần đăng nhập tại aitruyen.net trước (qua nút "Đăng nhập tại trang nguồn").

var HOST = "https://aitruyen.net";

function stripHtml(s) {
    return (s || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ").trim();
}

function cleanContent(html) {
    if (!html) return "";
    // Xóa script/style
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    // Xóa form, quảng cáo, bình luận
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    // Xóa điều hướng chương
    html = html.replace(/<a[^>]*>[\s]*(?:Chương trước|Chương sau|Mục lục|Chương liền kề)[\s]*<\/a>/gi, "");
    // Xóa copyright footer
    html = html.replace(/Copyright[\s\S]*$/i, "");
    return html;
}

function execute(url) {
    // Trích slug truyện và số chương
    var storySlugMatch = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!storySlugMatch) return null;
    var storySlug = storySlugMatch[1];
    var chapNum = storySlugMatch[2];

    var chapUrl = HOST + "/truyen/" + storySlug + "/chuong-" + chapNum;

    // === Phương pháp 1: Dùng Browser/WebView để lấy nội dung render bởi JS ===
    // AiTruyen dùng Next.js, nội dung chương được load bằng JS phía client
    // Cần browser engine để render
    try {
        var browser = Engine.newBrowser();
        if (browser) {
            browser.launch(chapUrl, 30000);

            // Chờ trang load hoàn tất
            var waitMs = 8000;
            var start = new Date().getTime();
            while (new Date().getTime() - start < waitMs) {}

            // Thử lấy nội dung từ DOM đã render
            var contentHtml = "";

            // Chiến lược 1: Tìm container chứa nội dung chương
            try {
                var domResult = browser.callJs(
                    "(function(){" +
                    "var sels=[" +
                    "'[class*=\"chapter-content\"]','[class*=\"chapter-body\"]'," +
                    "'[class*=\"reader-content\"]','[class*=\"content-render\"]'," +
                    "'[class*=\"reading\"]','[class*=\"prose\"]'," +
                    "'article','main'" +
                    "];" +
                    "for(var i=0;i<sels.length;i++){" +
                    "  try{var el=document.querySelector(sels[i]);" +
                    "  if(!el)continue;" +
                    "  var ps=el.querySelectorAll('p');" +
                    "  if(ps.length>=3){" +
                    "    var html='';" +
                    "    for(var j=0;j<ps.length;j++){" +
                    "      var t=ps[j].innerText.trim();" +
                    "      if(t.length>2)html+='<p>'+t+'</p>';" +
                    "    }" +
                    "    if(html.length>100)return html;" +
                    "  }" +
                    "  }catch(e){}}" +
                    "return '';" +
                    "})()",
                    10000
                );
                var domText = String(domResult && domResult.text ? domResult.text() : domResult || "");
                if (domText.length > 100) contentHtml = domText;
            } catch (e) { }

            // Chiến lược 2: Lấy toàn bộ body text
            if (!contentHtml || contentHtml.length < 100) {
                try {
                    var bodyResult = browser.callJs(
                        "(function(){" +
                        "var body=document.body;" +
                        "if(!body)return '';" +
                        "var text=body.innerText||'';" +
                        "return text;" +
                        "})()",
                        8000
                    );
                    var bodyText = String(bodyResult && bodyResult.text ? bodyResult.text() : bodyResult || "");

                    if (bodyText.length > 200) {
                        // Trích nội dung truyện từ body text
                        var lines = bodyText.split("\n");
                        var goodLines = [];
                        var BAD_LINES = /^(Trang chủ|Bỏ qua|Top tuần|Khám phá|Bảng xếp hạng|Tìm kiếm|Chương liền kề|Thảo luận khi đọc|Mặc định chỉ hiện|bình luận|phản hồi|Đăng nhập|Đăng ký|Login|TrướcChương|trướcSauChương|sau|Trước|Sau|Mục lục|Gợi ý|Lối vào chính|Yêu cầu gỡ|Góp ý|AI Truyện|Copyright|\d+\s*phản hồi|0 phản hồi)$/i;

                        for (var li = 0; li < lines.length; li++) {
                            var line = lines[li].trim();
                            if (!line) continue;
                            if (line.length < 5) continue;
                            if (BAD_LINES.test(line)) continue;
                            // Bỏ header: dòng quá ngắn hoặc chứa chỉ tên truyện
                            if (line.length < 15 && /^(Chương\s+\d+|Chapter\s+\d+)$/i.test(line)) continue;
                            // Bỏ navigation text
                            if (/^(TrướcChương|trướcSau|Chương\s*sau|Chương\s*trước)/.test(line)) continue;
                            // Content lines thường dài > 20 ký tự
                            if (line.length > 20) {
                                goodLines.push(line);
                            }
                        }

                        if (goodLines.length >= 3) {
                            var parts = [];
                            for (var gi = 0; gi < goodLines.length; gi++) {
                                parts.push("<p>" + goodLines[gi] + "</p>");
                            }
                            contentHtml = parts.join("\n");
                        }
                    }
                } catch (e) { }
            }

            // Chiến lược 3: Lấy từ __NEXT_DATA__
            if (!contentHtml || contentHtml.length < 100) {
                try {
                    var nextResult = browser.callJs(
                        "(function(){var el=document.getElementById('__NEXT_DATA__');return el?el.textContent:''})()",
                        5000
                    );
                    var nextText = String(nextResult && nextResult.text ? nextResult.text() : nextResult || "");
                    if (nextText.length > 50) {
                        var nd = JSON.parse(nextText);
                        var pp = nd && nd.props && nd.props.pageProps;
                        if (pp) {
                            var chapter = pp.chapter || pp.data || {};
                            var content = chapter.content || chapter.text || "";
                            if (content && content.length > 50) {
                                contentHtml = "<p>" + content.replace(/\n/g, "</p><p>") + "</p>";
                            }
                        }
                    }
                } catch (e) { }
            }

            try { browser.close(); } catch (_) { }

            if (contentHtml && stripHtml(contentHtml).length > 50) {
                contentHtml = cleanContent(contentHtml);
                return Response.success(contentHtml);
            }
        }
    } catch (e) {
        // Browser không khả dụng hoặc lỗi, fallback sang HTML scraping
    }

    // === Phương pháp 2: HTML scraping trực tiếp (hạn chế vì Next.js render phía client) ===
    var response = fetch(chapUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/truyen/" + storySlug,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "vi-VN,vi;q=0.9,en;q=0.8"
        }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            // Chưa đăng nhập - trả về URL trang nguồn để VBook hiện nút đăng nhập
            return Response.error(chapUrl);
        }
        return Response.error(chapUrl);
    }

    var doc = response.html("utf-8");
    if (!doc) return Response.error(chapUrl);

    var pageHtml = doc.html() || "";

    // Thử lấy nội dung từ __NEXT_DATA__
    try {
        var nextDataEl = doc.select("script#__NEXT_DATA__").first();
        if (nextDataEl) {
            var nextJson = nextDataEl.html();
            if (nextJson && nextJson.length > 10) {
                var nd = JSON.parse(nextJson);
                var pp = nd && nd.props && nd.props.pageProps;
                if (pp) {
                    // Tìm chapter content
                    var chapter = pp.chapter || pp.data || {};
                    var content = chapter.content || chapter.text || chapter.body || "";

                    if (typeof content === "string" && content.length > 100) {
                        var html = "<p>" + content.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
                        html = cleanContent(html);
                        if (stripHtml(html).length > 50) {
                            return Response.success(html);
                        }
                    }

                    // Kiểm tra xem content có bị mã hóa hoặc yêu cầu đăng nhập không
                    if (chapter.requireLogin || pp.requireLogin || pp.requireAuth) {
                        return Response.error(chapUrl);
                    }
                }
            }
        }
    } catch (e) { }

    // Tìm nội dung từ DOM (khó vì Next.js render phía client)
    var html = "";

    // Tìm container chứa nội dung chương
    var containers = doc.select("main div, article div, [class*='chapter'] div, [class*='content'] div");
    var bestContainer = null;
    var bestPCount = 0;

    for (var ci = 0; ci < Math.min(containers.size(), 30); ci++) {
        var container = containers.get(ci);
        var pCount = container.select("p").size();
        if (pCount > bestPCount) {
            bestPCount = pCount;
            bestContainer = container;
        }
    }

    if (bestContainer && bestPCount >= 3) {
        html = bestContainer.html() || "";
        html = cleanContent(html);
    }

    // Fallback: ghép từ các thẻ p
    if (!html || stripHtml(html).length < 100) {
        var paragraphs = doc.select("main p, article p, [class*='chapter'] p, [class*='content'] p");
        if (paragraphs.size() === 0) {
            paragraphs = doc.select("p");
        }
        var parts = [];
        var skippedKeywords = [
            /^(?:Mục lục|Chương trước|Chương sau|Đăng nhập|Đăng ký|Chương liền kề)$/i,
            /^(?:Prev|Next|Table of contents|Login|Register)$/i,
            /^(?:\d+|Trang \d+)$/,
            /^A[\+\-]$/,
            /^(?:Thảo luận khi đọc|Mặc định chỉ hiện)$/i,
            /^(?:TrướcChương|trướcSauChương|sau)$/,
            /^\d+\s*phản hồi$/i
        ];

        for (var pi = 0; pi < paragraphs.size(); pi++) {
            var p = paragraphs.get(pi);
            var text = (p.text() || "").replace(/\s+/g, " ").trim();
            if (!text || text.length < 2) continue;

            var skip = false;
            for (var ki = 0; ki < skippedKeywords.length; ki++) {
                if (skippedKeywords[ki].test(text)) { skip = true; break; }
            }
            if (skip) continue;

            parts.push("<p>" + p.html() + "</p>");
        }

        if (parts.length >= 3) {
            html = parts.join("\n");
        }
    }

    // Nếu có nội dung hợp lệ
    if (html && stripHtml(html).length > 100) {
        html = cleanContent(html);
        return Response.success(html);
    }

    // === Không tải được nội dung ===
    // AiTruyen yêu cầu đăng nhập và nội dung render bằng JS phía client
    // Trả về Response.error(url) để VBook hiện nút "Ấn vào trang nguồn" cho người dùng
    // đăng nhập rồi quay lại tải lại
    return Response.error(chapUrl);
}
