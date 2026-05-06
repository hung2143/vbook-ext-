load('config.js');

function execute(url) {
    url = url.replace(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img, BASE_URL);
    if (url.slice(-1) !== "/")
        url = url + "/";

    let response = fetch(url);
    if (response.ok) {
        let doc = response.html();
        const data = [];
        const seen = {};

        // Lấy book ID từ URL để filter chỉ chapter links
        let bookIdMatch = url.match(/\/bqg\/(\d+)/);
        let bookId = bookIdMatch ? bookIdMatch[1] : "";

        // Có 2 div.directoryArea: div đầu là "最新章节" (chương mới nhất, thứ tự ngược),
        // div thứ 2 là "正文" (nội dung chính, thứ tự đúng)
        // Lấy tất cả chapter links từ div thứ 2 (正文)
        let allDirs = doc.select(".directoryArea");
        let targetDir = null;

        if (allDirs.size() > 1) {
            // Dùng div thứ 2 (正文 - nội dung chính)
            targetDir = allDirs.get(1);
        } else if (allDirs.size() === 1) {
            targetDir = allDirs.get(0);
        }

        if (targetDir) {
            let el = targetDir.select("p a");
            for (let i = 0; i < el.size(); i++) {
                let e = el.get(i);
                let href = e.attr("href");
                let name = e.text().trim();
                if (!name || !href) continue;

                // Tạo full URL
                let fullUrl = href;
                if (!href.startsWith("http")) {
                    fullUrl = BASE_URL + href;
                }

                // Tránh trùng lặp
                if (seen[fullUrl]) continue;
                seen[fullUrl] = true;

                data.push({
                    name: name,
                    url: fullUrl,
                    host: BASE_URL
                });
            }
        }

        // Xử lý phân trang - lấy tất cả các trang tiếp theo
        let pageSelect = doc.select("#indexselect option");
        if (pageSelect.size() > 1) {
            for (let p = 1; p < pageSelect.size(); p++) {
                let pageUrl = pageSelect.get(p).attr("value");
                if (!pageUrl) continue;

                // URL phân trang có thể trỏ đến domain khác (CDN mirror)
                // Cần giữ nguyên URL gốc vì nó redirect đúng
                try {
                    let pageResp = fetch(pageUrl);
                    if (pageResp.ok) {
                        let pageDoc = pageResp.html();
                        let pageDir = null;

                        // Trang phân trang chỉ có 1 directoryArea
                        let pageDirs = pageDoc.select(".directoryArea");
                        if (pageDirs.size() > 1) {
                            pageDir = pageDirs.get(1);
                        } else if (pageDirs.size() === 1) {
                            pageDir = pageDirs.get(0);
                        }

                        if (pageDir) {
                            let pageLinks = pageDir.select("p a");
                            for (let j = 0; j < pageLinks.size(); j++) {
                                let pe = pageLinks.get(j);
                                let pHref = pe.attr("href");
                                let pName = pe.text().trim();
                                if (!pName || !pHref) continue;

                                let pFullUrl = pHref;
                                if (!pHref.startsWith("http")) {
                                    pFullUrl = BASE_URL + pHref;
                                }

                                if (seen[pFullUrl]) continue;
                                seen[pFullUrl] = true;

                                data.push({
                                    name: pName,
                                    url: pFullUrl,
                                    host: BASE_URL
                                });
                            }
                        }
                    }
                } catch (e) {
                    // Bỏ qua lỗi trang phân trang, tiếp tục
                }
            }
        }

        if (data.length > 0) {
            return Response.success(data);
        }
    }
    return null;
}
