var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function fetchDoc(url, referer) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": referer || HOST + "/",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "zh-CN,zh;q=0.9"
        }
    });
    if (response.ok) return response.html();

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        return browser.launch(url, 15000);
    } catch (e) {
        return null;
    } finally {
        try { browser.close(); } catch (e2) {}
    }
}

function cleanContent(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<div[^>]*id=["']content_tip["'][^>]*>[\s\S]*?<\/div>/gi, "");
    html = html.replace(/最新网址[^<]*m\.kudushu\.org/gi, "");
    html = html.replace(/（本章未完[^)]*）/g, "");
    html = html.replace(/第\d+章[^<]{0,80}\(第\d+\/\d+页\)/g, "");
    html = html.replace(/&nbsp;/g, " ");
    return html.trim();
}

function findNextPage(doc, basePath) {
    var nextHref = "";
    doc.select("a").forEach(function(a) {
        var text = (a.text() || "").replace(/\s+/g, "").trim();
        if (text === "下—页" || text === "下一页" || text === "下页") {
            nextHref = a.attr("href") || "";
        }
    });

    if (!nextHref) return "";
    if (nextHref.indexOf(basePath + "_") === -1) return "";
    return normalizeUrl(nextHref);
}

function execute(url) {
    if (!url) return null;
    if (url.indexOf("http") !== 0) url = HOST + url;

    var baseMatch = url.match(/(\/html\/\d+\/\d+)/);
    if (!baseMatch) return null;
    var basePath = baseMatch[1];

    var fullContent = "";
    var currentUrl = url;
    var guard = 0;

    while (currentUrl && guard < 20) {
        guard++;
        var doc = fetchDoc(currentUrl, url);
        if (!doc) break;

        var contentEl = doc.select("#novelcontent, .novelcontent").first();
        var html = contentEl ? contentEl.html() : "";
        html = cleanContent(html);
        if (html) fullContent += html;

        var nextUrl = findNextPage(doc, basePath);
        if (!nextUrl) break;

        sleep(1200);
        currentUrl = nextUrl;
    }

    if (!fullContent) return null;
    return Response.success(fullContent);
}
