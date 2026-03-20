function cleanHtml(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    return html;
}

function htmlToText(html) {
    if (!html) return "";
    return String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isReadableHtml(html) {
    var text = htmlToText(html);
    if (!text || text.length < 30) return false;
    if (/^(đăng nhập|login|sign in)$/i.test(text)) return false;
    return true;
}

function plainTextToHtml(text) {
    if (!text) return "";
    var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/g);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var line = (lines[i] || "").trim();
        if (!line) continue;
        out.push("<p>" + line + "</p>");
    }
    return out.join("\n");
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

    var content = cleanHtml(json.chapter.content || "");
    if (content && content.indexOf("<") < 0) {
        content = plainTextToHtml(content);
    }

    return {
        content: content,
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
        if (isReadableHtml(html)) return html;
    }
    return cleanHtml(doc.html() || "");
}

function execute(url) {
    try {
        var apiRes = tryApiContent(url);
        var apiHtml = apiRes && apiRes.content ? apiRes.content : "";

        if (apiHtml && isReadableHtml(apiHtml) && !isCipherLikeContent(apiHtml)) {
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

        if (isReadableHtml(html) && !isCipherLikeContent(html)) {
            return Response.success(html);
        }

        var textOnly = (doc.text() || "").replace(/\s+/g, " ").trim();
        if (textOnly && textOnly.length > 60 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(textOnly)) {
            return Response.success(plainTextToHtml(textOnly));
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
