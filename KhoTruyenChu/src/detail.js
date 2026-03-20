function execute(url) {
    var response = fetch(url, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://khotruyenchu.sbs/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html("utf-8");

    function cleanText(s) {
        return (s || "").replace(/\s+/g, " ").trim();
    }

    function stripHtml(html) {
        return cleanText((html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "));
    }

    var name = doc.select("h1, h2").first();
    var title = name ? name.text() : doc.select("title").text();
    title = cleanText((title || "").replace(/^\s*bộ\s*truyện\s*/i, ""));

    var cover = doc.select("meta[property='og:image']").attr("content");
    if (!cover) cover = doc.select(".entry-content img, article img, img").first().attr("src");
    if (cover && !cover.startsWith("http")) cover = "https://khotruyenchu.sbs" + cover;

    var fullText = doc.text() || "";

    var author = "";
    var category = "";
    var status = "";

    var am = fullText.match(/Tác\s*giả\s*:\s*([^📌🏷\n]+)/i);
    if (am) author = cleanText(am[1]);

    var cm = fullText.match(/Thể\s*loại\s*:\s*([^📌\n]+)/i);
    if (cm) category = cleanText(cm[1]);

    var sm = fullText.match(/Tình\s*trạng\s*:\s*([^\n]+)/i);
    if (sm) status = cleanText(sm[1]);

    var contentNode = doc.select(".entry-content, article .entry-content, article").first();
    var contentHtml = contentNode ? contentNode.html() : doc.html();

    // Chỉ giữ phần giới thiệu truyện, bỏ khối cập nhật chương + danh sách chương.
    var introHtml = contentHtml;
    var cutMarkers = ["#### Chương mới cập nhật", "### Danh sách chương", "[📖 Đọc Từ Đầu]", "[⚡ Chương Mới Nhất]"];
    var cut = introHtml.length;
    for (var i = 0; i < cutMarkers.length; i++) {
        var idx = introHtml.indexOf(cutMarkers[i]);
        if (idx > 0 && idx < cut) cut = idx;
    }
    introHtml = introHtml.substring(0, cut);

    var introText = stripHtml(introHtml);
    introText = cleanText(introText.replace(new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), ""));

    // Loại một số text rác thường xuất hiện trong block giới thiệu.
    introText = cleanText(introText
        .replace(/Skip to content/gi, "")
        .replace(/Copyright\s*©[^]+$/i, "")
    );

    var infoLines = [];
    if (author) infoLines.push("Tác giả: " + author);
    if (category) infoLines.push("Thể loại: " + category);
    if (status) infoLines.push("Trạng thái: " + status);
    var info = infoLines.join("<br>");

    var desc = introText;
    if (!desc) {
        desc = doc.select("meta[name='description']").attr("content") || title;
        desc = cleanText(desc);
    }

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc || title,
        detail: info,
        ongoing: status ? !/hoàn|hoan\s*thanh|đã\s*xong|da\s*xong/i.test(status) : true,
        host: "https://khotruyenchu.sbs"
    });
}
