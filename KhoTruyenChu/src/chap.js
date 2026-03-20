function cleanHtml(html) {
    if (!html) return "";
    // Loại bỏ cảnh báo sao chép và phần comment/bảng quảng cáo đơn giản.
    html = html.replace(/Cảnh\s*báo[^<]{0,120}khotruyenchu\.sbs/gi, "");
    html = html.replace(/Đọc\s*bản\s*dịch[^<]{0,120}khotruyenchu\.sbs/gi, "");
    return html;
}

function execute(url) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://khotruyenchu.sbs/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");
    var content = doc.select(".entry-content, article .entry-content, .post-content").first();
    var html = content ? content.html() : doc.html();
    html = cleanHtml(html);

    return Response.success(html);
}
