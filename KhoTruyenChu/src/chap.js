function cleanHtml(html) {
    if (!html) return "";
    // Loại bỏ cảnh báo sao chép và phần comment/bảng quảng cáo đơn giản.
    html = html.replace(/Cảnh\s*báo[^<]{0,120}khotruyenchu\.sbs/gi, "");
    html = html.replace(/Đọc\s*bản\s*dịch[^<]{0,120}khotruyenchu\.sbs/gi, "");

    // Loại bỏ các khối điều hướng/chỉnh giao diện trong trang chương.
    html = html.replace(/<a[^>]*>\s*[≣\s]*Mục\s*lục\s*<\/a>/gi, "");
    html = html.replace(/<a[^>]*>\s*Chương\s*sau\s*»?\s*<\/a>/gi, "");
    html = html.replace(/Cỡ\s*chữ\s*:\s*A-\s*A\+/gi, "");
    html = html.replace(/[◑o]\s*Giao\s*diện/gi, "");

    // Loại bỏ các phần subscribe/login/comment cuối bài.
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|subscribe|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    html = html.replace(/Copyright[\s\S]*$/i, "");

    // Xóa script/style còn sót.
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

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
    var content = doc.select(".entry-content, article .entry-content, .post-content, .content-inner").first();
    var html = content ? content.html() : doc.html();
    html = cleanHtml(html);

    return Response.success(html);
}
