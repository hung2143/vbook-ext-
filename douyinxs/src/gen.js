load('config.js');

function execute(url, page) {
    if (!page) page = '1';
    url = url.replace(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img, BASE_URL);
    let response = fetch(BASE_URL + url + "/" + page + "/");
    if (response.ok) {
        let doc = response.html();
        const data = [];
        
        // Process items from #main .hot_sale
        doc.select("#main .hot_sale").forEach(e => {
            data.push({
                name: e.select(".title").text(),
                link: BASE_URL + e.select("a").attr("href"),
                author: e.select(".author").text().replace('作者：', ''),
                description: e.select(".review").text(),
                host: BASE_URL
            });
        });

        let next = (parseInt(page) + 1).toString();
        return Response.success(data, next);
    }
    return null;
}
