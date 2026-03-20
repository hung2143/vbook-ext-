function cleanHtml(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    return html;
}

function isCipherLikeContent(html) {
    var s = (html || "").replace(/\s+/g, " ").trim();
    if (!s || s.length < 40) return false;
    if (/^\{\s*"v"\s*:\s*\d+/i.test(s) && /"l2"\s*:/i.test(s)) return true;
    if (/^\{\s*"v"\s*:\s*\d+/i.test(s) && /[A-Za-z0-9+/=]{80,}/.test(s)) return true;
    return false;
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

function tryApiContent(url) {
    var chapterId = extractChapterId(url);
    if (!chapterId) return { content: "", requireLogin: false };

    var response = fetch("https://trangtruyen.site/api/chapters/" + chapterId, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });
    if (!response.ok) return { content: "", requireLogin: false };

    var json = response.json();
    if (!json || !json.chapter) return { content: "", requireLogin: false };

    return {
        content: cleanHtml(json.chapter.content || ""),
        requireLogin: !!json.requireLogin
    };
}

function extractHtmlContent(doc) {
    var selectors = [
        ".chapter-content",
        ".reader-content",
        ".chapter-body",
        "article",
        "main",
        ".content",
        "body"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var node = doc.select(selectors[i]).first();
        if (!node) continue;
        var html = cleanHtml(node.html() || "");
        if (html && html.length > 80) return html;
    }
    return cleanHtml(doc.html() || "");
}

function execute(url) {
    try {
        var apiRes = tryApiContent(url);
        var apiHtml = apiRes && apiRes.content ? apiRes.content : "";

        if (apiHtml && apiHtml.length > 80 && !isCipherLikeContent(apiHtml)) {
            return Response.success(apiHtml);
        }

        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });

        if (!response.ok) {
            if (apiRes && apiRes.requireLogin) {
                return Response.success("<p>Nội dung chương yêu cầu đăng nhập. Hãy đăng nhập lại trong app rồi tải lại chương.</p>");
            }
            if (apiHtml && isCipherLikeContent(apiHtml)) {
                return Response.success("<p>Nội dung chương đang được mã hóa từ nguồn. Plugin hiện chưa giải mã tự động được chương này.</p>");
            }
            return Response.success("<p>Không tải được nội dung chương từ nguồn. Bạn có thể bấm 'Xem trang nguồn' rồi thử lại.</p>");
        }

        var doc = response.html("utf-8");
        var html = extractHtmlContent(doc);

        if (html && html.length > 20 && !isCipherLikeContent(html)) {
            return Response.success(html);
        }

        var text = doc.text() || "";
        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(text) || (apiRes && apiRes.requireLogin)) {
            return Response.success("<p>Nội dung chương yêu cầu đăng nhập. Hãy đăng nhập lại trong app rồi tải lại chương.</p>");
        }

        if ((apiHtml && isCipherLikeContent(apiHtml)) || isCipherLikeContent(html)) {
            return Response.success("<p>Nội dung chương đang được mã hóa từ nguồn. Plugin hiện chưa giải mã tự động được chương này.</p>");
        }

        return Response.success("<p>Không tải được nội dung chương từ nguồn. Bạn có thể bấm 'Xem trang nguồn' rồi thử lại.</p>");
    } catch (e) {
        return Response.success("<p>Không tải được nội dung chương do lỗi tạm thời. Hãy thử tải lại hoặc mở trang nguồn.</p>");
    }
}
