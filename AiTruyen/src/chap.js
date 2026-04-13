// chap.js - Lấy nội dung chương trên AiTruyen
// URL dạng: https://aitruyen.net/truyen/[slug]/chuong-[n]
//
// Chiến lược:
// 1. Thử lấy cookie từ localCookie (nếu đã đăng nhập qua browser của app)
// 2. Nếu có cookie → gọi API /api/chapters/{handle}/content
// 3. Nếu API thất bại hoặc không có cookie → dùng Engine.newBrowser() render
//    và dùng callJs() để trích chính xác nội dung các đoạn truyện

var HOST = "https://aitruyen.net";

/**
 * Lấy cookie session từ localCookie (chia sẻ với Engine.newBrowser).
 */
function getSessionCookies() {
    try {
        var c = localCookie.getCookie();
        if (c && String(c).length > 5) return String(c);
    } catch (e) {}
    return "";
}

/**
 * Trích chapterHandle từ RSC data (script __next_f) trong HTML.
 */
function extractChapterHandle(html) {
    var m = html.match(/\\\"chapterHandle\\\":\\\"(rh1\\.[^\"\\]+)/)
           || html.match(/"chapterHandle":"(rh1\.[^"]+)"/);
    return m ? m[1] : "";
}

/**
 * Gọi API content với cookie.
 * Trả về chuỗi HTML nội dung, hoặc rỗng nếu thất bại.
 */
function callContentApi(chapUrl, chapterHandle, cookieStr) {
    var bffProof = "";
    var bffMatch = cookieStr.match(/(?:^|;)\s*aitruyen_bff_proof=([^;]+)/);
    if (bffMatch) {
        try { bffProof = decodeURIComponent(bffMatch[1].trim()); }
        catch (e) { bffProof = bffMatch[1].trim(); }
    }

    var contentUrl = HOST + "/api/chapters/" + encodeURIComponent(chapterHandle) + "/content";
    var apiHeaders = {
        "user-agent": UserAgent.chrome(),
        "accept": "application/json",
        "content-type": "application/json",
        "referer": chapUrl,
        "origin": HOST,
        "cookie": cookieStr
    };
    if (bffProof) apiHeaders["x-aitruyen-browser-proof"] = bffProof;

    try {
        var apiResp = fetch(contentUrl, {
            method: "POST",
            headers: apiHeaders,
            body: "{}"
        });
        if (!apiResp || !apiResp.ok) return "";

        var json = apiResp.json();
        if (!json) return "";
        if (json.status === "requires_auth") return "";

        var contentHtml = json.contentHtml || json.content || json.html || "";
        return String(contentHtml).trim();
    } catch (e) {}
    return "";
}

/**
 * Dùng Engine.newBrowser() để render trang rồi dùng callJs() trích nội dung.
 *
 * Phân tích cấu trúc HTML AiTruyen (từ RSC data):
 *  - div.reader-surface > article.mt-6  → chứa nội dung chương thực sự
 *  - Article header: div[class*="border-b"]  → title + ngày/giờ đọc → BỎ QUA
 *  - Nội dung chương: các thẻ <p> bên dưới header (sau khi API trả về)
 *  - chapterFeed: nằm NGOÀI article, chứa teaser ~10 chương xung quanh → BỎ QUA
 *
 * Vấn đề cũ:
 *  - JS lấy tất cả <p> trong article → bao gồm cả header và chapterFeed
 *  - chapterFeed bị render vào DOM với title chương ("Chương 5...") và ngày tháng
 *  - Text bị vỡ dòng do fallback split('\n') không bảo toàn đoạn văn
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(chapUrl, 10000);

        var jsCode = "(function(){" +
            // ─── Bước 1: Định vị article chứa nội dung chương ───────────────
            // Cấu trúc đã xác nhận qua RSC data:
            //   .reader-surface > article.mt-6  (nội dung thực)
            //   Ngoài article: chapterFeed với teaser nhiều chương → KHÔNG LẤY
            "var prose=null;" +
            "var surface=document.querySelector('[class*=\"reader-surface\"]');" +
            "if(surface){" +
            "  var art=surface.querySelector('article');" +
            "  if(art){" +
            "    var live=art.querySelector('[aria-live]');" +
            "    prose=live||art;" +
            "  }" +
            "}" +
            // Fallback: article đầu trong main (không qua chapterFeed)
            "if(!prose){" +
            "  var mainEl=document.querySelector('main');" +
            "  if(mainEl){" +
            "    var arts=mainEl.querySelectorAll('article');" +
            "    for(var ai=0;ai<arts.length;ai++){" +
            "      var txt0=((arts[ai].innerText||arts[ai].textContent)||'');" +
            "      if(txt0.length>100){" +
            "        var live2=arts[ai].querySelector('[aria-live]');" +
            "        prose=live2||arts[ai];break;" +
            "      }" +
            "    }" +
            "  }" +
            "}" +
            "if(!prose)return '';" +

            // ─── Bước 2: Clone và loại bỏ các phần tử không phải nội dung ───
            // Xóa: header block (title/date = div[class*='border-b']),
            //       buttons, icons, subscription/AI-gate, skeleton loaders
            "var clone=prose.cloneNode(true);" +
            "var rmSel=[" +
            "  'button','[role=\"button\"]','[role=\"switch\"]'," +
            "  'form','script','style','svg','header','nav','footer'," +
            "  '[hidden]','[aria-hidden=\"true\"]'," +
            "  '[class*=\"animate-pulse\"]','[class*=\"sr-only\"]'," +
            // Header block trong article: div.space-y-3.border-b (title + date/time)
            "  'div[class*=\"border-b\"]'," +
            // Lock/gate UI
            "  '[class*=\"lock\"]','[class*=\"gate\"]','[class*=\"paywall\"]'," +
            "  '[class*=\"subscribe\"]','[class*=\"unlock\"]'" +
            "].join(',');" +
            "var rmEls=clone.querySelectorAll(rmSel);" +
            "for(var ri=rmEls.length-1;ri>=0;ri--){" +
            "  try{var rp=rmEls[ri].parentNode;if(rp)rp.removeChild(rmEls[ri]);}catch(e){}" +
            "}" +

            // ─── Bước 3: Lấy nội dung từ các thẻ <p> ───────────────────────
            // Mỗi <p> = một đoạn văn → wrap vào <p>...</p> để bảo toàn xuống hàng
            "var ps=clone.querySelectorAll('p');" +
            "var res=[];" +
            "for(var pi=0;pi<ps.length;pi++){" +
            "  var ptxt=((ps[pi].innerText||ps[pi].textContent)||'').trim();" +
            // Bỏ p rỗng / quá ngắn (label UI)
            "  if(ptxt.length<10)continue;" +
            // Bỏ p chỉ là ngày tháng / thời gian đọc (vd: '22/01/2026', '10 phút đọc')
            "  if(/^[\\d\\/\\s:\\-·•]+$/.test(ptxt))continue;" +
            "  if(/^\\d+\\s*(phút|giờ|giây)\\s*(đọc)?$/i.test(ptxt))continue;" +
            // Bỏ p là tiêu đề chương  (Chương X: ...)
            "  if(/^(Chương|Quyển|Tập|Chapter)\\s+\\d+[:\\s]/i.test(ptxt))continue;" +
            "  res.push('<p>'+ptxt+'</p>');" +
            "}" +
            "if(res.length>=2)return res.join('\\n');" +

            // ─── Fallback: tách innerText theo đoạn văn (\\n\\n) ────────────
            "var raw=((clone.innerText||clone.textContent)||'').trim();" +
            "if(raw.length<30)return '';" +
            "var blocks=raw.split(/\\n{2,}/);" +
            "res=[];" +
            "for(var bi=0;bi<blocks.length;bi++){" +
            "  var blk=blocks[bi].trim();" +
            "  if(blk.length<10)continue;" +
            "  if(/^[\\d\\/\\s:\\-·•]+$/.test(blk))continue;" +
            "  if(/^\\d+\\s*(phút|giờ|giây)\\s*(đọc)?$/i.test(blk))continue;" +
            "  if(/^(Chương|Quyển|Tập|Chapter)\\s+\\d+[:\\s]/i.test(blk))continue;" +
            "  res.push('<p>'+blk+'</p>');" +
            "}" +
            "if(res.length>=2)return res.join('\\n');" +
            // Last resort: từng dòng
            "var lines=raw.split('\\n');" +
            "res=[];" +
            "for(var li=0;li<lines.length;li++){" +
            "  var ln=lines[li].trim();" +
            "  if(ln.length<20)continue;" +
            "  if(/^[\\d\\/\\s:\\-·•]+$/.test(ln))continue;" +
            "  if(/^(Chương|Quyển|Tập|Chapter)\\s+\\d+[:\\s]/i.test(ln))continue;" +
            "  res.push('<p>'+ln+'</p>');" +
            "}" +
            "return res.join('\\n');" +
            "})()";

        var result = browser.callJs(jsCode, 8000);
        var content = "";
        if (result) {
            try { content = result.text ? String(result.text()) : String(result); }
            catch (e) { content = String(result); }
        }

        browser.close();

        if (content && content.trim().length > 50) {
            return content.trim();
        }
        return "";
    } catch (e) {
        try { if (browser) browser.close(); } catch (_) {}
        return "";
    }
}

function execute(url) {
    var m = url.match(/\/truyen\/([^/?#]+)\/chuong-(\d+)/);
    if (!m) return null;
    var storySlug = m[1];
    var chapNum = m[2];
    var chapUrl = HOST + "/truyen/" + storySlug + "/chuong-" + chapNum;

    // === Bước 1: Thử lấy cookie từ localCookie ===
    var cookieStr = getSessionCookies();

    // === Bước 2: Nếu có cookie → thử lấy chapterHandle qua HTTP và gọi API ===
    if (cookieStr) {
        try {
            var pageResp = fetch(chapUrl, {
                headers: {
                    "user-agent": UserAgent.chrome(),
                    "referer": HOST,
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "accept-language": "vi-VN,vi;q=0.9,en;q=0.8",
                    "cookie": cookieStr
                }
            });

            if (pageResp && pageResp.ok) {
                var doc = pageResp.html("utf-8");
                if (doc) {
                    var pageHtml = doc.html() || "";
                    var chapterHandle = extractChapterHandle(pageHtml);

                    if (chapterHandle) {
                        var apiContent = callContentApi(chapUrl, chapterHandle, cookieStr);
                        if (apiContent && apiContent.length > 10) {
                            return Response.success(apiContent);
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // === Bước 3: Dùng browser để render (có hoặc không có cookie) ===
    // Browser đã lưu session từ lần đăng nhập trước trên aitruyen.net
    var browserContent = loadViaNewBrowser(chapUrl);
    if (browserContent && browserContent.length > 50) {
        return Response.success(browserContent);
    }

    // Chưa đăng nhập hoặc không lấy được nội dung
    return Response.error("Vui lòng đăng nhập tại aitruyen.net trên trình duyệt của ứng dụng, sau đó thử lại.");
}
