function getBookId(url) {
    var match = String(url || "").match(/[?&](?:bookid|book_id|resourceid)=([0-9]+)/i);
    return match ? match[1] : "";
}

function execute(url) {
    var resourceId = getBookId(url);
    if (!resourceId) return Response.success([]);

    var catalogUrl = "https://novel.html5.qq.com/cgi-bin/novel_reader/catalog?book_id=" + resourceId;
    var response = fetch(catalogUrl, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": "https://bookshelf.html5.qq.com/qbread/adread/catalog?bookid=" + resourceId
        }
    });

    if (!response || !response.ok) return Response.success([]);

    var doc = response.json() || {};
    var chapters = Array.isArray(doc.catalog) ? doc.catalog : [];
    var data = [];

    chapters.forEach(function(chapter) {
        if (!chapter.serial_id || !chapter.serial_name) return;

        data.push({
            name: chapter.serial_name,
            url: "https://bookshelf.html5.qq.com/qbread/api/wenxue/buy/ad-chapter/v3?resourceid=" + resourceId + "&serialid=" + chapter.serial_id + "&apn=1&readnum=1&duration=2&srcCh=",
            host: "https://bookshelf.html5.qq.com"
        });
    });

    return Response.success(data);
}
