function execute(key, page) {
    if (!page) page = '1';
    var searchUrl = 'https://trangtruyen.site/tim-kiem?word=' + encodeURIComponent(key) + '&page=' + page;
    var response = fetch(searchUrl);
    if (!response.ok) return null;

    var doc = response.html('utf-8');

    var data = [];

    var items = doc.select("a[href^='https://trangtruyen.site/stories/'], a[href^='/stories/']");
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
            link: link,
            cover: '',
            description: '',
            host: 'https://trangtruyen.site'
        });
    });

    var next = null;
    return Response.success(data, next);
}
