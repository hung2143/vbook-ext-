var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function normalizeCover(url) {
    if (!url) return "";
    if (url.indexOf("http://") === 0) return "https://" + url.substring(7);
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("http") === 0) return url;
    if (url.indexOf("/") === 0) return HOST + url;
    return HOST + "/" + url;
}

function parseArticles(doc) {
    var data = [];

    var items = doc.select(".article");
    if (items.size() > 0) {
        items.forEach(function(item) {
            var link = item.select("h6 a").attr("href");
            var name = item.select("h6 a").text();
            if (!link || !name) return;

            var cover = "";
            var img = item.select(".pic img").first();
            if (img) cover = normalizeCover(img.attr("data-src") || img.attr("src"));

            var author = item.select(".author").text().trim();
            var desc = item.select(".simple").text().replace(/\s+/g, " ").trim();

            data.push({
                name: name.trim(),
                link: normalizeUrl(link),
                host: HOST,
                cover: cover,
                description: author ? (author + (desc ? " - " + desc : "")) : desc
            });
        });
        return data;
    }

    doc.select(".articlegeneral").forEach(function(item) {
        var link = item.select(".p2 a").attr("href");
        var name = item.select(".p2 a").text();
        if (!link || !name) return;

        var category = item.select(".p1").text().replace(/[\[\]]/g, "").trim();
        var author = item.select(".p3").text().trim();
        var desc = "";
        if (category) desc += category;
        if (author) desc += (desc ? " - " : "") + author;

        data.push({
            name: name.trim(),
            link: normalizeUrl(link),
            host: HOST,
            cover: "",
            description: desc
        });
    });

    return data;
}

function findNextPage(doc, currentUrl) {
    var nextHref = "";
    doc.select("a").forEach(function(a) {
        var text = (a.text() || "").replace(/\s+/g, "").trim();
        if (text === "下页" || text === "下一页" || text === "下一頁") {
            nextHref = a.attr("href") || "";
        }
    });

    if (!nextHref) return null;

    var match = currentUrl.match(/\/(\d+)\.html$/);
    if (match) {
        return (parseInt(match[1], 10) + 1).toString();
    }

    var ascMatch = currentUrl.match(/\/asc-(\d+)\/?$/);
    if (ascMatch) {
        return (parseInt(ascMatch[1], 10) + 1).toString();
    }

    return null;
}

function execute(url, page) {
    var targetUrl = url;
    if (page) {
        if (targetUrl.match(/\/\d+\.html$/)) {
            targetUrl = targetUrl.replace(/\/\d+\.html$/, "/" + page + ".html");
        } else if (targetUrl.match(/\/asc-\d+\/?$/)) {
            targetUrl = targetUrl.replace(/\/asc-\d+\/?$/, "/asc-" + page + "/");
        }
    }

    var response = fetch(targetUrl, {
        headers: {
            "user-agent": UserAgent.android(),
            "referer": HOST + "/"
        }
    });
    if (!response.ok) return null;

    var doc = response.html();
    var data = parseArticles(doc);
    var next = findNextPage(doc, targetUrl);

    return Response.success(data, next);
}
