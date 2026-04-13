// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// AiTruyen là React/Next.js SPA:
//   - HTML source = shell rỗng, nội dung được render client-side
//   - Cần browser render + đợi React hydrate
//   - Dùng browser.html() (jsoup) hoặc callJs() để lấy rendered DOM
//
// Pattern tham khảo: sangtacviet (retry loop + sleep + browser.html)

var HOST = "https://aitruyen.net";

function execute(url) {
    var m = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!m) return null;
    var chapUrl = HOST + "/truyen/" + m[1] + "/chuong-" + m[2];

    var browser = Engine.newBrowser();
    try {
        browser.launch(chapUrl, 30000);

        // === Cách 1: Retry loop với browser.html() (giống sangtacviet) ===
        var retry = 0;
        while (retry < 6) {
            sleep(2000);
            try {
                var doc = browser.html();
                if (doc) {
                    // Tìm article.reader-prose (nội dung truyện sạch)
                    var content = doc.select("article.reader-prose");
                    if (content.size() == 0) {
                        content = doc.select("[class*=rich-content]");
                    }
                    if (content.size() > 0) {
                        content.select("script,style,svg,button,[role=button],[aria-hidden=true]").remove();
                        var html = String(content.html());
                        if (html.length > 50) {
                            browser.close();
                            return Response.success(html);
                        }
                    }
                }
            } catch (e) {}
            retry++;
        }

        // === Cách 2: callJs lấy innerHTML từ rendered DOM ===
        // (callJs chạy JS thực trong browser → thấy DOM đã render bởi React)
        try {
            var jsResult = browser.callJs(
                "(function(){" +
                "var a=document.querySelector('article.reader-prose');" +
                "if(!a)a=document.querySelector('[class*=\"rich-content\"]');" +
                "if(a)return a.innerHTML;" +
                "var arts=document.querySelectorAll('article');" +
                "for(var i=0;i<arts.length;i++){" +
                "  if((arts[i].innerText||'').length>100)return arts[i].innerHTML;" +
                "}" +
                "return '';" +
                "})()",
                8000
            );
            if (jsResult) {
                var raw = "";
                try { raw = String(jsResult.text ? jsResult.text() : jsResult); }
                catch (e) { raw = String(jsResult); }

                if (raw.length > 50) {
                    // Parse HTML string bằng Html.parse() → Document (jsoup)
                    var parsed = Html.parse(raw);
                    parsed.select("script,style,svg,button").remove();
                    browser.close();
                    return Response.success(parsed.body().html());
                }
            }
        } catch (e) {}

        browser.close();
    } catch (e) {
        try { browser.close(); } catch (_) {}
    }

    return Response.error("Vui lòng đăng nhập tại aitruyen.net trên trình duyệt của ứng dụng, sau đó thử lại.");
}
