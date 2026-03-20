function execute(url) {
    let response = fetch(url);
    if (response.ok) {
        let doc = response.html('utf-8');

        // Ước lượng nội dung chương nằm trong <main> hoặc <article>.
        let contentEl = doc.select('main article, main .chapter-content, article, .chapter-content').first();
        let html = contentEl ? contentEl.html() : doc.select('main').html();

        return Response.success(html);
    }
    return null;
}
