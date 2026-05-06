var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function extractBookId(href) {
    var m = href.match(/\/html\/(\d+)\//);
    return m ? m[1] : "";
}

function execute(key, page) {
    if (!key) return Response.success([]);
    var searchUrl = HOST + "/modules/article/search.php?searchkey=" + encodeURIComponent(key);

    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) return null;

    var doc = response.html();
    var data = [];
    var seen = {};

    doc.select(".searchresult a[href*='/html/']").forEach(function(a) {
        var href = a.attr("href") || "";
        var bookId = extractBookId(href);
        if (!bookId) return;

        var title = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!title) return;

        var link = HOST + "/book/" + bookId + "/";
        if (seen[link]) return;
        seen[link] = true;

        data.push({
            name: title,
            link: link,
            host: HOST,
            cover: "",
            description: ""
        });
    });

    return Response.success(data);
}
