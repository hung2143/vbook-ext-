function execute(url) {
    var response = fetch(url);
    if (!response.ok) return null;

    var doc = response.html('utf-8');

    // Trang đọc yêu cầu đăng nhập nên nội dung có thể không lấy được
    // nếu không có cookie. Khi đó chỉ trả lại toàn bộ phần thân.
    var contentEl = doc.select('.chapter-content, main, article').first();
    var html = contentEl ? contentEl.html() : doc.html();

    return Response.success(html);
}
