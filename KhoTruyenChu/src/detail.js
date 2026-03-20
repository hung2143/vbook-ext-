function execute(url) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://khotruyenchu.sbs/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");

    var name = doc.select("h1, h2").first();
    var title = name ? name.text() : doc.select("title").text();

    var cover = doc.select("meta[property='og:image']").attr("content");
    if (!cover) cover = doc.select(".entry-content img, article img, img").first().attr("src");
    if (cover && !cover.startsWith("http")) cover = "https://khotruyenchu.sbs" + cover;

    var desc = doc.select("meta[name='description']").attr("content");
    if (!desc) {
        var p = doc.select(".entry-content p, article p, p").first();
        if (p) desc = p.text();
    }

    var detailHtml = doc.select(".entry-content, article .entry-content, article").first();
    var detail = detailHtml ? detailHtml.html() : doc.html();

    return Response.success({
        name: title,
        cover: cover,
        description: desc || title,
        detail: detail,
        host: "https://khotruyenchu.sbs"
    });
}
