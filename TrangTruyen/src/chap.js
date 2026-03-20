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

    var looksLikeHtml = /<p[\s>]|<div[\s>]|<br\s*\/?\s*>|<article[\s>]|<section[\s>]/i.test(s);
    if (looksLikeHtml) return false;

    var alphaNum = (s.match(/[A-Za-z0-9]/g) || []).length;
    var punct = (s.match(/[{}\[\]"'\/:+=]/g) || []).length;
    if (alphaNum > 150 && punct > 30 && punct / Math.max(1, s.length) > 0.08) return true;

    return false;
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

function tryApiContent(url) {
    var chapterId = extractChapterId(url);
    if (!chapterId) return "";

    var response = fetch("https://trangtruyen.site/api/chapters/" + chapterId, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });
    if (!response.ok) return "";

    var json = response.json();
    if (!json || !json.chapter) return { content: "", requireLogin: false };

    var content = json.chapter.content || "";
    return {
        content: content ? cleanHtml(content) : "",
        requireLogin: !!json.requireLogin
    };
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
        if (!response.ok) return null;

        var doc = response.html("utf-8");
        var selectors = [
            ".chapter-content",
            "article",
            "main",
            ".content",
            "body"
        ];

        var html = "";
        for (var i = 0; i < selectors.length; i++) {
            var node = doc.select(selectors[i]).first();
            if (!node) continue;
            html = node.html() || "";
            if (html && html.length > 80) break;
        }

        if (!html) html = doc.html() || "";
        html = cleanHtml(html);

        if (isCipherLikeContent(html)) {
            return Response.success("<p>Nội dung chương hiện đang được mã hóa từ nguồn truyện, plugin chưa thể giải mã tự động.</p>");
        }

        var text = doc.text() || "";
        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(text) || (apiRes && apiRes.requireLogin && (!html || html.length < 80))) {
            return null;
        }

        return Response.success(html);
    } catch (e) {
        return null;
    }
}
