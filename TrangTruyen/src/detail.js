function execute(url) {
    let response = fetch(url);
    if (response.ok) {
        let doc = response.html('utf-8');

        // Tiêu đề truyện
        let nameEl = doc.select('h1, h2').first();
        let name = nameEl ? nameEl.text() : doc.select('title').text();

        // Ảnh bìa (ước lượng: ảnh đầu tiên trong khu nội dung)
        let coverEl = doc.select('main img, article img, img').first();
        let cover = coverEl ? coverEl.attr('src') : '';
        if (cover && !cover.startsWith('http')) cover = 'https://trangtruyen.site' + cover;

        // Mô tả ngắn: ưu tiên thẻ meta description, sau đó đoạn văn đầu tiên
        let desc = doc.select("meta[name='description']").attr('content');
        if (!desc) {
            let p = doc.select('main p, article p').first();
            if (p) desc = p.text();
        }

        // Thông tin chi tiết (thể loại, trạng thái, số chương...) nếu có
        let detailBlock = doc.select('main').text();

        return Response.success({
            name: name,
            cover: cover,
            description: desc || detailBlock,
            detail: detailBlock,
            host: 'https://trangtruyen.site'
        });
    }
    return null;
}
