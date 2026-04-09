// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// QUAN TRỌNG: AiTruyen yêu cầu đăng nhập để đọc nội dung chương.
// Plugin sẽ dùng cookie từ phiên đăng nhập của người dùng (nếu VBook hỗ trợ).
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
    html = html.replace(/<div[^>]*class="[^"]*(?:comment|ads?|related|share|nav|footer|header|sidebar)[^"]*"[\s\S]*?<\/div>/gi, "");
    // Xóa điều hướng chương
    html = html.replace(/<a[^>]*>[\s]*(?:Chương trước|Chương sau|Mục lục)[\s]*<\/a>/gi, "");
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

    // === Thử API lấy nội dung chương ===
    // API endpoint đã xác nhận: POST /api/chapters/[id]/content
    // Nhưng cần chapter ID - thử lấy từ HTML trước

    // === Lấy trang HTML chương ===
    var response = fetch(chapUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": HOST + "/truyen/" + storySlug,
            // Cookie sẽ được VBook tự động thêm vào nếu người dùng đã đăng nhập
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "vi-VN,vi;q=0.9,en;q=0.8"
        }
    });

    if (!response.ok) {
        // Lỗi 401/403: chưa đăng nhập
        if (response.status === 401 || response.status === 403) {
            return Response.success(
                "<p><strong>⚠️ Bạn cần đăng nhập tại trang nguồn để đọc chương này.</strong></p>" +
                "<p>Vui lòng nhấn nút <strong>Đăng nhập tại trang nguồn</strong> trong ứng dụng, " +
                "đăng nhập vào tài khoản aitruyen.net rồi thử lại.</p>"
            );
        }
        return null;
    }

    var doc = response.html("utf-8");
    if (!doc) return null;

    var pageHtml = doc.html() || "";

    // Kiểm tra xem có bị yêu cầu đăng nhập không
    var loginGate = pageHtml.indexOf("đăng nhập để") >= 0 || pageHtml.indexOf("login to") >= 0
        || pageHtml.indexOf("Đăng Nhập Để Đọc") >= 0;
    if (loginGate) {
        // Kiểm tra an toàn hơn bằng cách xem nội dung thực sự có không
        var contentCheck = doc.select("p").size();
        if (contentCheck < 3) {
            return Response.success(
                "<p><strong>⚠️ Bạn cần đăng nhập tại trang aitruyen.net để đọc chương này.</strong></p>" +
                "<p>Vui lòng nhấn nút <strong>Đăng nhập tại trang nguồn</strong> để đăng nhập, " +
                "sau đó quay lại đọc truyện.</p>" +
                "<p><em>Lưu ý: Một số chương có thể yêu cầu thêm xu để mở khóa.</em></p>"
            );
        }
    }

    // === Thử lấy chapter ID từ __NEXT_DATA__ để gọi API ===
    var chapterId = "";
    var nextDataMatch = pageHtml.match(/"id"\s*:\s*"?(\d+)"?\s*,\s*"(?:number|chapterNumber|chapter_number)"\s*:\s*"?/) ||
        pageHtml.match(/"chapterId"\s*:\s*"?(\w+)"?/) ||
        pageHtml.match(/"chapter"\s*:\s*\{[^}]*"id"\s*:\s*"?(\w+)"?/);
    if (nextDataMatch) chapterId = nextDataMatch[1];

    // Nếu có chapter ID, thử API
    if (chapterId) {
        var apiUrl = HOST + "/api/chapters/" + chapterId + "/content";
        var apiResp = fetch(apiUrl, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": chapUrl,
                "accept": "application/json"
            }
        });
        if (apiResp.ok) {
            try {
                var json = apiResp.json();
                var content = json.content || json.data || json.text || "";
                if (typeof content === "string" && content.length > 100) {
                    content = cleanContent(content);
                    if (stripHtml(content).length > 50) {
                        return Response.success(content);
                    }
                }
            } catch (e) { /* thử HTML scraping */ }
        }
    }

    // === HTML scraping: tìm nội dung chính ===
    var html = "";

    // Tìm container nội dung chương
    // AiTruyen dùng Next.js, nội dung thường trong một div chứa các thẻ p
    // Selector tốt nhất: tìm div có nhiều thẻ p nhất (thường là nội dung chương)
    var containers = doc.select("main div, article div, [class*='chapter'] div, [class*='content'] div, [id*='chapter'], [id*='content']");
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
        // Loại bỏ nội dung không liên quan
        html = cleanContent(html);
    }

    // Fallback: ghép từ các thẻ p trong main/article
    if (!html || stripHtml(html).length < 100) {
        var paragraphs = doc.select("main p, article p, [class*='chapter'] p, [class*='content'] p");
        if (paragraphs.size() === 0) {
            paragraphs = doc.select("p");
        }
        var parts = [];
        var skippedKeywords = [
            /^(?:Mục lục|Chương trước|Chương sau|Đăng nhập|Đăng ký)$/i,
            /^(?:Prev|Next|Table of contents|Login|Register)$/i,
            /^(?:\d+|Trang \d+)$/,
            /^A[\+\-]$/, // font size controls
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

    // Nếu vẫn không có nội dung
    if (!html || stripHtml(html).length < 100) {
        return Response.success(
            "<p><strong>⚠️ Không tải được nội dung chương.</strong></p>" +
            "<p>Có thể bạn cần <strong>đăng nhập tại trang nguồn</strong> để đọc chương này. " +
            "Vui lòng đăng nhập vào tài khoản aitruyen.net và thử lại.</p>"
        );
    }

    html = cleanContent(html);
    return Response.success(html);
}
