function execute(key, page) {
    if (!key) return Response.success([]);

    var response = fetch(
        "https://so.html5.qq.com/ajax/real/search_result?tabId=360&noTab=1&q=" + encodeURIComponent(key),
        { headers: { "user-agent": UserAgent.android(), "referer": "https://bookshelf.html5.qq.com/qbread" } }
    );

    if (!response || !response.ok) return Response.success([]);

    var json = response.json() || {};
    var bookList = json.data && Array.isArray(json.data.state) ? json.data.state : [];
    var data = [];

    function extractBookId(url) {
        var match = String(url || "").match(/[?&](?:bookid|book_id|resourceid)=([0-9]+)/i);
        return match ? match[1] : "";
    }

    bookList.forEach(function(group) {
        if (!group.items || !group.items.length) return;

        var book = group.items[0];
        var bookId = extractBookId(book.jump_url);
        if (!bookId || !book.title) return;

        data.push({
            name: book.title,
            link: "https://novel.html5.qq.com/portal/novel-intro?bookid=" + bookId,
            cover: book.cover_url || "",
            description: book.author || "",
            host: "https://novel.html5.qq.com"
        });
    });

    return Response.success(data);
}
