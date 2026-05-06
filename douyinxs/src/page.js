load('config.js');
function execute(url) {
    url = url.replace(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img, BASE_URL);
    let response = fetch(url);
    if (response.ok) {
        let doc = response.html();
        let pages = [];
        doc.select("#indexselect option").forEach(e => {
            let pageUrl = e.attr("value");
            if (pageUrl) {
                // URL phân trang có thể đã là full URL (trỏ đến CDN mirror)
                // hoặc là relative path
                if (!pageUrl.startsWith("http")) {
                    pageUrl = BASE_URL + pageUrl;
                }
                pages.push(pageUrl);
            }
        });
        if (pages.length === 0) {
            pages.push(url);
        }
        return Response.success(pages);
    }
    return null;
}