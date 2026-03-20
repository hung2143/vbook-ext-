function execute(url, page) {
    if (!page) page = '1';
    var listUrl = url + page;
    var doc = Http.get(listUrl).html();

    if (!doc) return null;

    var data = [];

    // Trên trang /stories, các truyện đều có link dạng
    // https://trangtruyen.site/stories/slug-... nên chỉ cần bắt theo href.
    var items = doc.select("a[href^='https://trangtruyen.site/stories/'], a[href^='/stories/']");

    var seen = {};
    items.forEach(function (a) {
        var link = a.attr('href');
        if (!link) return;
        if (!link.startsWith('http')) link = 'https://trangtruyen.site' + link;
        if (seen[link]) return;
        seen[link] = true;

        var name = a.text();
        if (!name) name = a.attr('title');

        data.push({
            name: name,
            link: link,
            cover: '',
            description: '',
            host: 'https://trangtruyen.site'
        });
    });

    // Trang hiện tại hầu như không hiển thị rõ nút trang kế,
    // nếu sau này có phân trang, có thể cải tiến thêm.
    var next = null;

    return Response.success(data, next);
}
