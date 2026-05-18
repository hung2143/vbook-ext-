var HOST = "https://sto55.com";

function fetchWithRetry(url) {
    for (var i = 0; i < 3; i++) {
        try {
            var response = fetch(url, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (response && response.ok) {
                var doc = response.html();
                var bodyText = doc.text() || "";
                if (bodyText.indexOf("访问太频繁") !== -1) {
                    sleep(30000);
                    continue;
                }
                return doc;
            }
        } catch (e) {
            Console.log("Fetch error: " + e);
            sleep(3000);
        }
    }
    return null;
}

function cleanContent(html) {
    // Xóa script, style, quảng cáo
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
    html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
    html = html.replace(/<ins[\s\S]*?<\/ins>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<img[^>]*>/gi, "");

    // Xóa div quảng cáo
    html = html.replace(/<div[^>]*class="[^"]*ad[^"]*"[\s\S]*?<\/div>/gi, "");
    html = html.replace(/<div[^>]*id="[^"]*ad[^"]*"[\s\S]*?<\/div>/gi, "");
    html = html.replace(/<div[^>]*class="[^"]*google[^"]*"[\s\S]*?<\/div>/gi, "");
    html = html.replace(/<div[^>]*id="aswift_\d+"[\s\S]*?<\/div>/gi, "");
    html = html.replace(/<div[^>]*class="[^"]*ADVERTISEMENT[^"]*"[\s\S]*?<\/div>/gi, "");

    // Xóa link ảnh
    html = html.replace(/<a[^>]*>[\s]*<img[^>]*>[\s]*<\/a>/gi, "");

    // Xóa heading
    html = html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "");

    // === Lọc watermark / quảng cáo tiếng Trung của sto55.com ===
    // Các câu này được chèn vào nội dung chương dưới dạng <p> hoặc text thuần

    // Domain & tên trang
    html = html.replace(/sto55\.com/gi, "");
    html = html.replace(/思兔[阅閱]读/g, "");       // "思兔阅读" / "思兔閱讀"
    html = html.replace(/思兔/g, "");               // chỉ "思兔" đứng một mình

    // "本章节来源于xxx" / "本章節來源於xxx" (Bản chương tiết bắt nguồn từ...)
    html = html.replace(/本章[节節][来來][源自於于][^\n<]{0,30}/g, "");

    // "想看更多精彩章节，请访问xxx" (Muốn nhìn nhiều đặc sắc hơn chương tiết, hãy ghé thăm...)
    html = html.replace(/想[看閱][更多]*精彩章[节節][，,\s]*请[访訪]问[^\n<]{0,30}/g, "");

    // "思兔提醒您查看最新内容" / "提醒您关注最新章节" (nhắc nhở ngài xem xét mới nhất nội dung)
    html = html.replace(/提醒[您你][关查][注看][^\n<]{0,30}/g, "");
    html = html.replace(/[关關][注][最]*新[章内][节節容][^\n<]{0,20}/g, "");

    // "请收藏本站" / "请记住本站" (xin hãy bookmark trang này)
    html = html.replace(/请[收记][藏住][本][站网][^\n<]{0,20}/g, "");

    // Xóa các thẻ <p> chỉ chứa domain / ký tự lẻ sau khi filter
    html = html.replace(/<p[^>]*>\s*<\/p>/gi, "");
    html = html.replace(/<p[^>]*>[\s\u3000\u00a0]*<\/p>/gi, "");

    // Copyright footer
    html = html.replace(/Copyright ©[\s\S]*$/gm, "");

    return html;
}

function extractContent(doc) {
    // sto55.com dùng class "readcotent" (viết sai chính tả - đây là class chính thức của trang)
    // KHÔNG dùng selector rộng như [class*='content'] vì sẽ bắt cả sidebar, quảng cáo, v.v.
    var selectors = [
        ".readcotent",          // Class chính của sto55.com (viết đúng theo nguồn)
        "#content",
        ".read-content",
        ".chapter-content",
        "#chapter-content",
        ".xs_content"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var el = doc.select(selectors[i]);
        if (el && el.first()) {
            var html = el.html() || "";
            if (html.length > 100) {
                Console.log("chap: content found via selector: " + selectors[i] + " (" + html.length + " chars)");
                return html;
            }
        }
    }
    return null;
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);

    Console.log("chap: fetching url=" + url);

    // sto55.com KHÔNG có phân trang trong chương (không có nút 下一页)
    // Chỉ có nút 下一章 (chương kế tiếp) - plugin cũ đã nhầm nút này thành phân trang
    // → Chỉ cần fetch đúng 1 URL, không loop sang chương khác

    var fullContent = "";

    // === Thử browser trước ===
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 20000);

        if (doc) {
            var bodyText = doc.text() || "";
            Console.log("chap: browser got " + bodyText.length + " chars");

            if (bodyText.indexOf("访问太频繁") !== -1) {
                Console.log("chap: rate limited, waiting 30s...");
                sleep(30000);
                doc = browser.launch(url, 20000);
            }
        }

        if (doc) {
            var content = extractContent(doc);
            if (content && content.length > 100) {
                fullContent = content;
            } else {
                Console.log("chap: content selector returned short result, trying body...");
                // Không fallback body vì sẽ bắt toàn trang (sidebar, nav, v.v.)
                // Chỉ log để debug
                Console.log("chap: page text preview: " + (doc.text() || "").substring(0, 200));
            }
        }
    } catch (e) {
        Console.log("chap browser error: " + e);
    } finally {
        try { browser.close(); } catch(e2) {}
    }

    // === Fallback: fetch thường ===
    if (!fullContent || fullContent.length < 100) {
        Console.log("chap: browser content too short, trying fetchWithRetry...");
        var doc2 = fetchWithRetry(url);
        if (doc2) {
            var content2 = extractContent(doc2);
            if (content2 && content2.length > 100) {
                fullContent = content2;
                Console.log("chap: fetchWithRetry got " + fullContent.length + " chars");
            }
        }
    }

    if (fullContent && fullContent.length > 100) {
        fullContent = cleanContent(fullContent);
        Console.log("chap: final content length=" + fullContent.length);
        return Response.success(fullContent);
    }

    Console.log("chap: failed to get content for url=" + url);
    return Response.error("无法获取章节内容，请稍后重试。");
}
