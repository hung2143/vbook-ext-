var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http://") === 0) return "https://" + link.substring(7);
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function normalizeHost(url) {
    if (!url) return url;
    return url.replace(/https?:\/\/(www\.)?kudushu\.org/i, HOST);
}

function getBookId(url) {
    var m = url.match(/\/book\/(\d+)/);
    if (m) return m[1];
    var m2 = url.match(/\/html\/(\d+)/);
    if (m2) return m2[1];
    return "";
}

function extractInfoText(doc, label) {
    var text = "";
    doc.select(".infotype p").forEach(function(p) {
        var t = (p.text() || "").trim();
        if (t.indexOf(label) === 0) {
            text = t.replace(label, "").replace(/^[：:]/, "").trim();
        }
    });
    return text;
}

function execute(url) {
    url = normalizeHost(url);
    var bookId = getBookId(url);
    if (!bookId) return null;

    var detailUrl = HOST + "/book/" + bookId + "/";
    var response = fetch(detailUrl, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": HOST + "/"
        }
    });

    if (!response.ok) return null;

    var doc = response.html();

    var title = doc.select(".cataloginfo h3").text().trim();
    if (!title) title = doc.select("meta[property='og:title']").attr("content") || "";

    var cover = doc.select(".infohead .pic img").attr("src") || "";
    if (!cover) cover = doc.select("meta[property='og:image']").attr("content") || "";
    cover = normalizeUrl(cover);

    var author = doc.select("meta[property='og:novel:author']").attr("content") || "";
    if (!author) author = extractInfoText(doc, "作者");

    var type = extractInfoText(doc, "类型");
    var updateTime = extractInfoText(doc, "更新时间");
    var latest = "";
    var latestEl = doc.select(".infotype p a").first();
    if (latestEl) latest = latestEl.text().trim();

    var desc = doc.select(".intro p").text().replace(/\s+/g, " ").trim();
    if (!desc) desc = doc.select("meta[name='description']").attr("content") || "";

    var status = doc.select("meta[property='og:novel:status']").attr("content") || "";
    var ongoing = true;
    if (status) ongoing = status.indexOf("连载") !== -1;

    var detailParts = [];
    if (author) detailParts.push("Tac gia: " + author);
    if (type) detailParts.push("The loai: " + type);
    if (updateTime) detailParts.push("Cap nhat: " + updateTime);
    if (latest) detailParts.push("Moi nhat: " + latest);

    return Response.success({
        name: title,
        cover: cover,
        author: author,
        description: desc || title,
        detail: detailParts.join("<br>"),
        ongoing: ongoing,
        host: HOST
    });
}
