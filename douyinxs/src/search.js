load("config.js");

function execute(key) {
    // Thử với queries (form POST theo chuẩn VBook)
    let response = fetch(BASE_URL + "/search/", {
        method: "POST",
        queries: {
            "searchkey": key
        },
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Referer": BASE_URL + "/"
        }
    });

    // Nếu queries không hoạt động, thử dùng body trực tiếp
    if (!response || !response.ok) {
        response = fetch(BASE_URL + "/search/", {
            method: "POST",
            body: "searchkey=" + encodeURIComponent(key),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                "Referer": BASE_URL + "/"
            }
        });
    }

    if (response && response.ok) {
        let doc = response.html();
        const books = [];

        // Cấu trúc: div.read_book > div.bookbox
        // Tên: h4.bookname > i.iTit > a
        // Link: a[href] đầu tiên trong bookbox
        // Cover: img[src]
        // Description: div.update > a (tên chương mới nhất)
        doc.select(".bookbox").forEach(e => {
            let nameEl = e.select("h4 a").first();
            let name = nameEl ? nameEl.text().trim() : "";
            if (!name) return;

            let href = e.select("a").first().attr("href") || "";
            if (!href) return;
            let link = href.startsWith("http") ? href : BASE_URL + href;

            let cover = e.select("img").attr("src") || "";

            let description = e.select(".update a").text().trim() || "";

            books.push({
                name: name,
                link: link,
                cover: cover,
                description: description,
                host: BASE_URL
            });
        });

        return Response.success(books);
    }

    return null;
}
