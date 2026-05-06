load('config.js');
function execute(url) {
    url = url.replace(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img, BASE_URL);
    if (url.slice(-1) !== "/")
        url = url + "/";

    let response = fetch(url);
    if (response.ok) {
        let doc = response.html();

        let coverImg = doc.select('meta[property="og:image"]').attr("content") || "";
        let descriptionMeta = doc.select('meta[property="og:description"]').attr("content") || "";
        let novelTitle = doc.select('meta[property="og:novel:book_name"]').attr("content") || "";
        let newChap = doc.select('meta[property="og:novel:latest_chapter_name"]').attr("content") || "";
        let author = doc.select('meta[property="og:novel:author"]').attr("content") || "";
        let novelCategory = doc.select('meta[property="og:novel:category"]').attr("content") || "";
        let status = doc.select('meta[property="og:novel:status"]').attr("content") || "";
        let updateTime = doc.select('meta[property="og:novel:update_time"]').attr("content") || "";
        updateTime = updateTime.replace(/\d\d:\d\d:\d\d/g, "").trim();

        // Fallback: nếu meta tags trống, thử lấy từ HTML
        if (!novelTitle) {
            let titleEl = doc.select("h1").first();
            if (titleEl) novelTitle = titleEl.text().trim();
        }
        if (!novelTitle) {
            novelTitle = doc.select("title").text().replace(/免费阅读.*$/, "").trim();
        }

        if (!author) {
            let authorEl = doc.select("b.author").first();
            if (authorEl) author = authorEl.text().replace(/作者[：:]\s*/g, "").trim();
        }

        if (!coverImg) {
            let imgEl = doc.select(".pic img, .cover img").first();
            if (imgEl) coverImg = imgEl.attr("src") || "";
        }
        // Đảm bảo cover URL đầy đủ
        if (coverImg && !coverImg.startsWith("http")) {
            coverImg = BASE_URL + coverImg;
        }

        if (!descriptionMeta) {
            let descEl = doc.select(".review").first();
            if (descEl) descriptionMeta = descEl.text().trim();
        }

        // Xác định trạng thái ongoing
        let ongoing = true;
        if (status) {
            if (/完结|完本|已完/.test(status)) {
                ongoing = false;
            }
        }

        // Đảm bảo có đủ thông tin cơ bản
        if (!novelTitle) {
            return null;
        }

        let detail = "";
        if (author) detail += "Tác giả: " + author;
        if (novelCategory) detail += (detail ? '<br>' : '') + "Thể loại: " + novelCategory;
        if (status) detail += (detail ? '<br>' : '') + "Tình trạng: " + status;
        if (newChap) detail += (detail ? '<br>' : '') + "Mới nhất: " + newChap;
        if (updateTime) detail += (detail ? '<br>' : '') + "Thời gian cập nhật: " + updateTime;

        return Response.success({
            name: novelTitle,
            cover: coverImg,
            author: author,
            description: descriptionMeta || novelTitle,
            detail: detail,
            ongoing: ongoing,
            host: BASE_URL
        });
    }
    return null;
}