function execute(key, page) {
    if (!page) page = '1';
    var searchUrl = 'https://trangtruyen.site/tim-kiem?word=' + encodeURIComponent(key) + '&page=' + page;
    var response = fetch(searchUrl);
    if (!response.ok) return null;

    var doc = response.html('utf-8');

    var data = [];

    // Bắt mọi link có chứa '/stories/' để tránh bỏ sót
    // do khác nhau giữa http/https hoặc query string.
    var items = doc.select("a[href*='/stories/']");
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

    // Fallback regex nếu DOM khác bản desktop.
    if (data.length === 0) {
        var html = doc.html();
        var regex = /(https:\/\/trangtruyen\.site\/stories\/[^"'>\s]+|\/stories\/[^"'>\s]+)/g;
        var m;
        while ((m = regex.exec(html)) !== null) {
            var link2 = m[0];
            if (!link2.startsWith('http')) link2 = 'https://trangtruyen.site' + link2;
            if (seen[link2]) continue;
            seen[link2] = true;

            var slug = link2.split('/').pop();
            var name2 = decodeURIComponent(slug.replace(/-/g, ' '));

            data.push({
                name: name2,
                link: link2,
                cover: '',
                description: '',
                host: 'https://trangtruyen.site'
            });
        }
    }

    var next = null;
    return Response.success(data, next);
}
