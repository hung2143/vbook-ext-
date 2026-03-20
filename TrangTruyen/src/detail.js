function execute(url) {
    var response = fetch(url, {
        headers: {
            'user-agent': UserAgent.chrome(),
            'referer': 'https://trangtruyen.site/'
        }
    });
    if (!response.ok) return null;

    var doc = response.html('utf-8');

    var nameEl = doc.select('h1, h2').first();
    var name = nameEl ? nameEl.text() : doc.select('title').text();

    var coverEl = doc.select('img').first();
    var cover = coverEl ? coverEl.attr('src') : '';
    if (cover && !cover.startsWith('http')) cover = 'https://trangtruyen.site' + cover;

    var desc = doc.select("meta[name='description']").attr('content');
    if (!desc) {
        var p = doc.select('p').first();
        if (p) desc = p.text();
    }

    var detailBlock = doc.text();

    return Response.success({
        name: name,
        cover: cover,
        description: desc || detailBlock,
        detail: detailBlock,
        host: 'https://trangtruyen.site'
    });
}
