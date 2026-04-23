var HOST = "https://m.1qxs.com";

function execute(url) {
    // Normalize URL to mobile
    url = url.replace(/https?:\/\/(www\.)?1qxs\.com/, HOST);
    // Ensure trailing slash
    if (!url.endsWith("/")) url = url + "/";

    // Extract book ID from URL pattern /xs_1/BOOKID/
    var bookIdMatch = url.match(/\/xs_1\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];
    var detailUrl = HOST + "/xs_1/" + bookId + "/";

    // Try with browser first to bypass anti-bot
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(detailUrl, 15000);

        if (!doc) {
            // Fallback: direct fetch with proper headers
            var response = fetch(detailUrl, {
                headers: {
                    "user-agent": UserAgent.android(),
                    "referer": HOST + "/",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
                }
            });
            if (!response.ok) return null;
            doc = response.html();
        }

        if (!doc) return null;

        // Rate limit check
        var bodyText = doc.text() || "";
        if (bodyText.indexOf("访问太频繁") !== -1) {
            sleep(30000);
            doc = browser.launch(detailUrl, 15000);
            if (!doc) return null;
        }

        // Extract book info
        var name = doc.select("h1").first();
        var title = name ? name.text().trim() : "";

        // Cover image
        var cover = "";
        var coverImg = doc.select(".book-cover img, .cover img, .pic img, img[src*='cover'], img[src*='bookimg']").first();
        if (coverImg) {
            cover = coverImg.attr("src") || coverImg.attr("data-src") || "";
            if (cover.startsWith("//")) cover = "https:" + cover;
            if (cover && !cover.startsWith("http")) cover = HOST + cover;
        }
        if (!cover) {
            // Try og:image meta
            var ogImg = doc.select("meta[property='og:image']").attr("content");
            if (ogImg) {
                cover = ogImg;
                if (cover.startsWith("//")) cover = "https:" + cover;
            }
        }

        // Author - look for author text
        var author = "";
        var authorEl = doc.select(".author, .book-author").first();
        if (authorEl) {
            author = authorEl.text().replace(/作者[：:]\s*/g, "").trim();
        }
        if (!author) {
            // Try from page text
            var authorMatch = bodyText.match(/作者[：:]\s*([^\s\n]+)/);
            if (authorMatch) author = authorMatch[1].trim();
        }

        // Description
        var desc = "";
        var descEl = doc.select(".book-intro, .intro, .desc, #intro").first();
        if (descEl) {
            desc = descEl.text().trim();
        }
        if (!desc) {
            var metaDesc = doc.select("meta[name='description']").attr("content");
            if (metaDesc) desc = metaDesc.trim();
        }

        // Detail info (status, word count, etc.)
        var detail = "";
        var detailEl = doc.select(".book-stats, .book-info, .info").first();
        if (detailEl) {
            detail = detailEl.html();
        }

        // Status (ongoing or completed)
        var ongoing = true;
        if (bodyText.indexOf("完结") !== -1 || bodyText.indexOf("完本") !== -1) {
            ongoing = false;
        }

        return Response.success({
            name: title,
            cover: cover,
            author: author,
            description: desc || title,
            detail: detail,
            ongoing: ongoing,
            host: HOST
        });
    } catch (e) {
        Console.log("detail error: " + e);
        return null;
    } finally {
        browser.close();
    }
}