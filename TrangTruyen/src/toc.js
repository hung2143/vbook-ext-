function execute(url) {
    let response = fetch(url);
    if (response.ok) {
        let doc = response.html('utf-8');
        const data = [];

        // Giả định danh sách chương là các link có chứa "chapter" hoặc "chuong".
        let items = doc.select("a[href*='chapter'], a[href*='chuong']");
        const seen = {};
        items.forEach(e => {
            let link = e.attr('href');
            if (!link) return;
            if (!link.startsWith('http')) link = 'https://trangtruyen.site' + link;
            if (seen[link]) return;
            seen[link] = true;

            let name = e.text();
            if (!name) name = e.attr('title');

            data.push({
                name: name,
                url: link,
                host: 'https://trangtruyen.site'
            });
        });

        return Response.success(data);
    }
    return null;
}
