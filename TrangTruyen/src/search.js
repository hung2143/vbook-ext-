function execute(key, page) {
    if (!page) page = '1';
    let searchUrl = 'https://trangtruyen.site/tim-kiem?word=' + encodeURIComponent(key) + '&page=' + page;
    let response = fetch(searchUrl);
    if (response.ok) {
        let doc = response.html('utf-8');
        const data = [];

        // Lưu ý: selector chỉ mang tính tham khảo, cần chỉnh theo DOM thực.
        let items = doc.select("a[href^='/stories/']");
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
                link: link,
                cover: '',
                description: '',
                host: 'https://trangtruyen.site'
            });
        });

        // TODO: thêm bắt trang tiếp theo nếu trang tìm kiếm hỗ trợ phân trang.
        let next = null;
        return Response.success(data, next);
    }
    return null;
}
