load("config.js");

function execute(key) {
    let response = fetch(BASE_URL + "/search/", {
        method: "POST",
        queries: {
            "searchkey": key
        }
    });

    if (response.ok) {
        let doc = response.html();
        const books = [];
        doc.select(".read_book .bookbox").forEach(e => {
            books.push({
                name: e.select("h4").first().text(),
                link: BASE_URL + e.select("a").first().attr("href"),
                cover: e.select("a img").attr("src"),
                description: e.select(".update a").text(),
                host: BASE_URL
            });
        });
        return Response.success(books);
    }

    return null;
}
