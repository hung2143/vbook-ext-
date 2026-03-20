function execute(key, page) {
    if (!page) page = "1";
    var pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    var searchUrl = "https://khotruyenchu.sbs/?s=" + encodeURIComponent(key);
    if (pageNum > 1) searchUrl += "&paged=" + pageNum;

    var response = fetch(searchUrl, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://khotruyenchu.sbs/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var data = [];
    var seen = {};

    var items = doc.select("a[href*='/truyen/']");
    items.forEach(function (e) {
        var link = e.attr('href');
        if (!link) return;
        if (!link.startsWith('http')) link = 'https://khotruyenchu.sbs' + link;
        if (seen[link]) return;
        seen[link] = true;

        var name = e.text();
        if (!name) name = e.attr('title');
        if (!name) {
            var slug = link.split('/').filter(Boolean).pop();
            name = decodeURIComponent(slug.replace(/-/g, ' '));
        }

        data.push({
            name: name,
            link: link,
            cover: "",
            description: "",
            host: "https://khotruyenchu.sbs"
        });
    });

    var next = null;
    var expectedNext = "&paged=" + (pageNum + 1);
    var hasNext = doc.html().indexOf(expectedNext) !== -1 || doc.select("a[href*='/page/" + (pageNum + 1) + "/']").size() > 0;
    if (hasNext && data.length > 0) next = (pageNum + 1).toString();

    return Response.success(data, next);
}
