function execute(url) {
    var doc = Http.get(url).html();
    if (!doc) return null;

    // Trang đọc yêu cầu đăng nhập nên nội dung có thể không lấy được
    // nếu không có cookie. Khi đó chỉ trả lại toàn bộ phần thân.
    var contentEl = doc.select('.chapter-content, main, article').first();
    var html = contentEl ? contentEl.html() : doc.html();

    return Response.success(html);
}
