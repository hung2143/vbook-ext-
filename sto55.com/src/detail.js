var HOST = "https://sto55.com";

function browserFetch(url, timeout) {
    if (!timeout) timeout = 20000;
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, timeout);
        if (doc) {
            var bodyText = doc.text() || "";
            if (bodyText.indexOf("访问太频繁") !== -1 || bodyText.indexOf("请稍后") !== -1) {
                sleep(30000);
                doc = browser.launch(url, timeout);
            }
        }
        return doc;
    } catch (e) {
        Console.log("Browser error: " + e);
        return null;
    } finally {
        browser.close();
    }
}

function fetchWithRetry(url) {
    for (var i = 0; i < 3; i++) {
        try {
            var response = fetch(url, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (response && response.ok) {
                var doc = response.html();
                var bodyText = doc.text() || "";
                if (bodyText.indexOf("访问太频繁") !== -1) {
                    sleep(30000);
                    continue;
                }
                return doc;
            }
            if (response && (response.status === 403 || response.status === 429)) {
                sleep(5000 * (i + 1));
                continue;
            }
        } catch (e) {
            Console.log("Fetch error attempt " + (i + 1) + ": " + e);
            sleep(5000);
        }
    }
    return null;
}

function execute(url) {
    url = url.replace(/https?:\/\/(www\.)?sto55\.com/, HOST);
    if (!url.endsWith("/")) url = url + "/";

    var bookIdMatch = url.match(/\/book\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    var detailUrl = HOST + "/book/" + bookId + "/";

    var doc = browserFetch(detailUrl);
    if (!doc) {
        doc = fetchWithRetry(detailUrl);
    }

    if (!doc) return null;

    var bodyText = doc.text() || "";

    var name = "";
    var h1 = doc.select("h1").first();
    if (h1) {
        name = h1.text().trim();
    }
    if (!name) {
        var titleMeta = doc.select("meta[property='og:title']").attr("content");
        if (titleMeta) {
            name = titleMeta.replace(/\s*最新章节.*$/, "").replace(/\s*思兔阅读.*$/, "").trim();
        }
    }
    if (!name) {
        var titleEl = doc.select("title").first();
        if (titleEl) {
            name = titleEl.text().replace(/\s*思兔阅读.*$/, "").replace(/\s*最新章节.*$/, "").trim();
        }
    }

    var cover = "";
    var ogImg = doc.select("meta[property='og:image']").attr("content");
    if (ogImg) {
        cover = ogImg;
        if (cover.startsWith("//")) cover = "https:" + cover;
    }
    if (!cover) {
        var coverImg = doc.select("img").first();
        if (coverImg) {
            cover = coverImg.attr("src") || coverImg.attr("data-src") || "";
            if (cover.startsWith("//")) cover = "https:" + cover;
            if (cover && !cover.startsWith("http")) cover = HOST + cover;
        }
    }

    var author = "";
    var authorMatch = bodyText.match(/作者[：:]\s*([^\s\n<]+)/);
    if (authorMatch) {
        author = authorMatch[1].replace(/<[^>]+>/g, "").trim();
    }
    if (!author) {
        var authorEl = doc.select(".author, [class*='author']").first();
        if (authorEl) {
            author = authorEl.text().replace(/作者[：:]\s*/g, "").trim();
        }
    }

    var desc = "";
    var descEl = doc.select(".intro, [class*='intro'], [class*='desc'], #intro").first();
    if (descEl) {
        desc = descEl.text().trim();
    }
    if (!desc) {
        var metaDesc = doc.select("meta[name='description']").attr("content");
        if (metaDesc) desc = metaDesc.trim();
    }
    if (!desc) {
        var metaOgDesc = doc.select("meta[property='og:description']").attr("content");
        if (metaOgDesc) desc = metaOgDesc.trim();
    }

    var statusMatch = bodyText.match(/(连载|完结|完結|连载中|完本)/);
    var ongoing = !statusMatch || (statusMatch[0] !== "完结" && statusMatch[0] !== "完本" && statusMatch[0] !== "完結");

    var category = "";
    var catMatch = bodyText.match(/分类[：:]\s*([^\s\n<]+)/);
    if (catMatch) category = catMatch[1].replace(/<[^>]+>/g, "").trim();

    var wordCount = "";
    var wcMatch = bodyText.match(/(\d+)\s*字/);
    if (wcMatch) wordCount = wcMatch[0];

    var detail = [];
    if (author) detail.push("作者: " + author);
    if (category) detail.push("分类: " + category);
    if (wordCount) detail.push("字数: " + wordCount);
    if (!ongoing) detail.push("状态: 完结");
    else detail.push("状态: 连载");

    return Response.success({
        name: name || "未知书名",
        cover: cover,
        author: author || "",
        description: desc || name || "",
        detail: detail.join("<br>"),
        ongoing: ongoing,
        host: HOST
    });
}
