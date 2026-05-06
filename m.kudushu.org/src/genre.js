var HOST = "https://m.kudushu.org";

function normalizeUrl(link) {
    if (!link) return "";
    if (link.indexOf("//") === 0) return "https:" + link;
    if (link.indexOf("http") === 0) return link;
    if (link.indexOf("/") === 0) return HOST + link;
    return HOST + "/" + link;
}

function isCloudflare(doc) {
    if (!doc) return true;
    var text = doc.text() || "";
    if (text.indexOf("Just a moment") !== -1) return true;
    if (text.indexOf("cf_chl") !== -1) return true;
    if (text.indexOf("Checking your browser") !== -1) return true;
    if (text.indexOf("Enable JavaScript and cookies") !== -1) return true;
    return false;
}

function loadDoc(url) {
    var browser = Engine.newBrowser();
    try {
        browser.setUserAgent(UserAgent.android());
        var doc = browser.launch(url, 30000);

        if (isCloudflare(doc)) {
            sleep(10000);
            doc = browser.launch(url, 30000);
        }
        if (isCloudflare(doc)) {
            sleep(15000);
            doc = browser.launch(url, 30000);
        }

        if (doc && !isCloudflare(doc)) {
            browser.close();
            return doc;
        }
    } catch (e) {
        Console.log("genre browser error: " + e);
    }
    try { browser.close(); } catch (e2) {}

    try {
        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.android(),
                "referer": HOST + "/"
            }
        });
        if (response.ok) {
            var fdoc = response.html();
            if (!isCloudflare(fdoc)) return fdoc;
        }
    } catch (e3) {}

    return null;
}

function execute() {
    var doc = loadDoc(HOST + "/modules/article/sortselect.php");

    if (!doc) {
        // If we can't load genre page, return hardcoded genres
        return Response.success([
            { title: "Xuan hoan", input: HOST + "/sort/1/1.html", script: "book.js" },
            { title: "Tu tien", input: HOST + "/sort/2/1.html", script: "book.js" },
            { title: "Do thi", input: HOST + "/sort/3/1.html", script: "book.js" },
            { title: "Lich su", input: HOST + "/sort/4/1.html", script: "book.js" },
            { title: "Khoa huyen", input: HOST + "/sort/5/1.html", script: "book.js" },
            { title: "Mao hiem", input: HOST + "/sort/6/1.html", script: "book.js" },
            { title: "Vo hiep", input: HOST + "/sort/7/1.html", script: "book.js" },
            { title: "Quan su", input: HOST + "/sort/8/1.html", script: "book.js" },
            { title: "Kinh di", input: HOST + "/sort/9/1.html", script: "book.js" },
            { title: "Ngon tinh", input: HOST + "/sort/10/1.html", script: "book.js" },
            { title: "Tong tai", input: HOST + "/sort/11/1.html", script: "book.js" },
            { title: "Khac", input: HOST + "/sort/12/1.html", script: "book.js" }
        ]);
    }

    var data = [];
    var seen = {};

    // Try standard selectors
    doc.select(".menu_nav a[href*='/sort/']").forEach(function(a) {
        var href = normalizeUrl(a.attr("href"));
        var title = (a.text() || "").replace(/\s+/g, " ").trim();
        if (!href || !title || seen[href]) return;
        seen[href] = true;
        data.push({ title: title, input: href, script: "book.js" });
    });

    // Broader fallback
    if (data.length === 0) {
        doc.select("a[href*='/sort/']").forEach(function(a) {
            var href = normalizeUrl(a.attr("href"));
            var title = (a.text() || "").replace(/\s+/g, " ").trim();
            if (!href || !title || title.length > 20 || seen[href]) return;
            seen[href] = true;
            data.push({ title: title, input: href, script: "book.js" });
        });
    }

    if (data.length === 0) {
        // Return hardcoded genres as last resort
        return Response.success([
            { title: "Xuan hoan", input: HOST + "/sort/1/1.html", script: "book.js" },
            { title: "Tu tien", input: HOST + "/sort/2/1.html", script: "book.js" },
            { title: "Do thi", input: HOST + "/sort/3/1.html", script: "book.js" },
            { title: "Lich su", input: HOST + "/sort/4/1.html", script: "book.js" },
            { title: "Khoa huyen", input: HOST + "/sort/5/1.html", script: "book.js" },
            { title: "Mao hiem", input: HOST + "/sort/6/1.html", script: "book.js" },
            { title: "Vo hiep", input: HOST + "/sort/7/1.html", script: "book.js" },
            { title: "Quan su", input: HOST + "/sort/8/1.html", script: "book.js" }
        ]);
    }

    return Response.success(data);
}
