var HOST = "https://m.kudushu.org";

var FALLBACK_GENRES = [
    { title: "玄幻魔法", id: 1 }, { title: "武侠修真", id: 2 },
    { title: "都市言情", id: 3 }, { title: "历史军事", id: 4 },
    { title: "侦探推理", id: 5 }, { title: "网游动漫", id: 6 },
    { title: "科幻小说", id: 7 }, { title: "恐怖灵异", id: 8 },
    { title: "言情小说", id: 9 }, { title: "其他类型", id: 10 },
    { title: "经部", id: 11 }, { title: "史书", id: 12 },
    { title: "子部", id: 13 }, { title: "集部", id: 14 },
    { title: "四库之外", id: 15 }, { title: "古典书籍", id: 16 },
    { title: "诗歌", id: 17 }, { title: "宋词", id: 18 }
];

function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}

function toUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (/^https?:/i.test(link)) return link.replace(/^http:\/\//i, "https://");
    return HOST + (link.charAt(0) === "/" ? link : "/" + link);
}

function isBlocked(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    return /Just a moment|Checking your browser|Enable JavaScript and cookies|cf[-_]chl|challenges\.cloudflare\.com/i.test(text);
}

function loadDoc(url) {
    try {
        var response = fetch(url, {
            headers: { "user-agent": UserAgent.android(), "referer": HOST + "/", "accept-language": "zh-CN,zh;q=0.9" }
        });
        if (response && response.ok && !isBlocked(response.html())) return response.html();
    } catch (ignore) {}

    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 25000);
        if (isBlocked(doc)) {
            sleep(4000);
            doc = browser.launch(url, 25000);
        }
        return isBlocked(doc) ? null : doc;
    } catch (e) {
        Console.log("kudushu genre: " + e);
        return null;
    } finally {
        try { browser.close(); } catch (ignore2) {}
    }
}

function fallback() {
    var data = [];
    FALLBACK_GENRES.forEach(function(genre) {
        data.push({ title: genre.title, input: HOST + "/sort/" + genre.id + "/1.html", script: "book.js" });
    });
    return data;
}

function execute() {
    var doc = loadDoc(HOST + "/modules/article/sortselect.php");
    if (!doc) return Response.success(fallback());

    var data = [];
    var seen = {};
    doc.select("a[href*='/sort/']").forEach(function(a) {
        var href = toUrl(a.attr("href") || "");
        var title = cleanText(a.text());
        if (!href || !title || seen[href]) return;
        seen[href] = true;
        data.push({ title: title, input: href, script: "book.js" });
    });

    return Response.success(data.length ? data : fallback());
}
