function cleanHtml(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    return html;
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
    if (!json || !json.chapter) return "";

    var content = json.chapter.content || "";
    if (!content) return "";
    return cleanHtml(content);
}

function execute(url) {
    try {
        var apiHtml = tryApiContent(url);
        if (apiHtml && apiHtml.length > 80) {
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

        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test((doc.text() || ""))) {
            return null;
        }

        return Response.success(html);
    } catch (e) {
        return null;
    }
}
