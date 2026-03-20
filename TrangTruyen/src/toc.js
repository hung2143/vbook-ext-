function execute(url) {
    var doc = Http.get(url).html();
    if (!doc) return null;

    var data = [];

    // Danh sách chương dùng link dạng /read/...
    var items = doc.select("a[href^='https://trangtruyen.site/read/'], a[href^='/read/']");
    var seen = {};
    items.forEach(function (e) {
        var link = e.attr('href');
        if (!link) return;
        if (!link.startsWith('http')) link = 'https://trangtruyen.site' + link;
        if (seen[link]) return;
        seen[link] = true;

        var name = e.text();
        if (!name) name = e.attr('title');

        data.push({
            name: name,
            url: link,
            host: 'https://trangtruyen.site'
        });
    });

    return Response.success(data);
}
