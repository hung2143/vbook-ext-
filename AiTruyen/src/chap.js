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
    var m = html.match(/\\\"chapterHandle\\\":\\\"(rh1\.[^\"\\]+)/)
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
 * Browser đã có session từ lần đăng nhập trước → nội dung sẽ hiện ra.
 * Chiến lược:
 *   1. Tìm article trong section ".reader-drop-cap" (selector đặc trưng của aitruyen.net)
 *   2. Lấy div[aria-live] chứa nội dung thực (không phải skeleton loading)
 *   3. Xóa các thành phần UI (button, svg, animate-pulse, sr-only, hidden)
 *   4. Lấy các <p> trong vùng nội dung đó — KHÔNG quét toàn trang
 *   5. Fallback: tách innerText theo dòng trong article (không toàn trang)
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        // Giảm xuống 10 giây — đủ để React + API load xong khi đã đăng nhập
        browser.launch(chapUrl, 10000);

        var jsCode = "(function(){" +
            // Bước 1: Tìm <article> bên trong section chứa nội dung chương
            // aitruyen.net dùng class 'reader-drop-cap' trên section content
            "var article=null;" +
            "var rdcSec=document.querySelector('.reader-drop-cap');" +
            "if(rdcSec)article=rdcSec.querySelector('article');" +
            "if(!article){" +
            // Fallback: tìm section có aria-label chứa 'dung' (Nội dung)
            "  var secs=document.querySelectorAll('section[aria-label]');" +
            "  for(var si=0;si<secs.length;si++){" +
            "    var lbl=(secs[si].getAttribute('aria-label')||'').toLowerCase();" +
            "    if(lbl.indexOf('dung')>=0||lbl.indexOf('content')>=0){" +
            "      article=secs[si].querySelector('article');break;" +
            "    }" +
            "  }" +
            "}" +
            "if(!article){" +
            // Fallback cuối: article đầu tiên có nội dung đủ dài
            "  var arts=document.querySelectorAll('main article,article');" +
            "  for(var ai=0;ai<arts.length;ai++){" +
            "    if(((arts[ai].innerText||arts[ai].textContent)||'').length>100){article=arts[ai];break;}" +
            "  }" +
            "}" +
            "if(!article)return '';" +
            // Bước 2: Ưu tiên div[aria-live] — chứa nội dung khi đã load xong
            "var contentDiv=article.querySelector('[aria-live]');" +
            "var targetEl=contentDiv||article;" +
            // Bước 3: Clone và loại bỏ các phần tử UI / skeleton / hidden
            "var clone=targetEl.cloneNode(true);" +
            "var rmSel='button,[role=\"button\"],[role=\"switch\"],form,script,style,svg,header,nav,footer,[hidden],[aria-hidden=\"true\"],[class*=\"animate-pulse\"],[class*=\"sr-only\"]';" +
            "var rmEls=clone.querySelectorAll(rmSel);" +
            "for(var ri=(rmEls.length-1);ri>=0;ri--){" +
            "  try{var p=rmEls[ri].parentNode;if(p)p.removeChild(rmEls[ri]);}catch(e){}" +
            "}" +
            // Bước 4: Lấy <p> từ vùng nội dung (KHÔNG quét toàn trang)
            "var ps=clone.querySelectorAll('p');" +
            "var res=[];" +
            "for(var pi=0;pi<ps.length;pi++){" +
            "  var txt=((ps[pi].innerText||ps[pi].textContent)||'').trim();" +
            "  if(txt.length>=10)res.push('<p>'+txt+'</p>');" +
            "}" +
            "if(res.length>=2)return res.join('\\n');" +
            // Fallback: tách theo dòng trong article scope (KHÔNG toàn trang)
            "var raw=((clone.innerText||clone.textContent)||'').trim();" +
            "if(raw.length<30)return '';" +
            "var lines=raw.split('\\n');" +
            "res=[];" +
            "for(var li=0;li<lines.length;li++){" +
            "  var ln=lines[li].trim();" +
            "  if(ln.length>=15)res.push('<p>'+ln+'</p>');" +
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
