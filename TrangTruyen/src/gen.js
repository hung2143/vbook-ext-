function execute(url, page) {
    if (!page) page = '1';
    // url dự kiến dạng: https://trangtruyen.site/stories?...&page=
    let listUrl = url + page;
    let response = fetch(listUrl);
    if (response.ok) {
        let doc = response.html('utf-8');
        const data = [];

        // Lưu ý: Các selector dưới đây mang tính ước lượng, bạn nên
        // mở trang /stories trong trình duyệt và chỉnh lại cho khớp DOM thực tế.
        // Giả định mỗi truyện nằm trong phần tử có data-story hoặc article.
        let items = doc.select("[data-story], article a[href^='/stories/']");

        const seen = {};
        items.forEach(e => {
            let a = e.tagName() === 'a' ? e : e.select("a[href^='/stories/']").first();
            if (!a) return;
            let link = a.attr('href');
            if (!link) return;
            if (!link.startsWith('http')) link = 'https://trangtruyen.site' + link;
            if (seen[link]) return;
            seen[link] = true;

            let name = a.text();
            if (!name) name = a.attr('title');

            let coverEl = e.select('img').first();
            let cover = coverEl ? coverEl.attr('src') : '';
            if (cover && !cover.startsWith('http')) cover = 'https://trangtruyen.site' + cover;

            let metaText = e.text();

            data.push({
                name: name,
                link: link,
                cover: cover,
                description: metaText,
                host: 'https://trangtruyen.site'
            });
        });

        // TODO: chỉnh selector phân trang cho đúng nếu có.
        let next = null;
        let nextLink = doc.select("a[href*='page=']").last();
        if (nextLink) {
            let m = nextLink.attr('href').match(/page=(\d+)/);
            if (m) next = m[1];
        }

        return Response.success(data, next);
    }
    return null;
}
