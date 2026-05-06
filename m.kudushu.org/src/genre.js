var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function execute() {
    var response = fetch(HOST + "/modules/article/sortselect.php", {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) return Response.success([]);

    var doc = response.html();
    var data = [];
    var seen = {};

    doc.select(".menu_nav a[href*='/sort/']").forEach(function(a) {
        var href = normalizeUrl(a.attr("href"));
        var title = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!href || !title || seen[href]) return;
        seen[href] = true;
        data.push({ title: title, input: href, script: "book.js" });
    });

    return Response.success(data);
}
