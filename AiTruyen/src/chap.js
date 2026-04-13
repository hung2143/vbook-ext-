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
 * Kiểm tra xem một đoạn text có phải là junk (nav/UI/metadata) không.
 * Trả về true nếu là junk cần bỏ qua.
 */
function isJunkLine(txt) {
    if (!txt || txt.length < 2) return true;
    // Tiêu đề chương dạng "Chương X: ..."
    if (/^(Chương|Quyển|Tập|Chapter)\s+\d+[:\s·•]/i.test(txt)) return true;
    // Breadcrumb / nav buttons
    if (/^(Trang chủ|Chương trước|Chương sau|Mục lục|Thảo luận|Nghe|Công cụ)/i.test(txt)) return true;
    // Ngày tháng đơn thuần: "01/11/2025" hoặc "22/01/2026"
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(txt) && txt.length < 30) return true;
    // Thời gian đọc: "9 phút đọc", "10 phút đọc"
    if (/^\d+\s*(phút|giờ|giây)\s*(đọc)?$/i.test(txt)) return true;
    // Dạng kết hợp "01/11/2025•9 phút đọc" hoặc "22/01/2026 • ..."
    if (/\d{1,2}\/\d{1,2}\/\d{4}\s*[•·]\s*\d+\s*(phút|giờ)/.test(txt)) return true;
    // AI badge: "AI Đang đọc bản convert", "Đang đọc bản AI", "Bản AI..."
    if (/^(AI\s|Bản AI|Đang đọc bản|AI Truyện)/i.test(txt) && txt.length < 120) return true;
    // "convert" riêng lẻ
    if (/^(convert|bản convert)$/i.test(txt)) return true;
    // Tab title dạng "10 • Chương 10: ..."
    if (/^\d+\s*[•·]\s*(Chương|Quyển|Tập)/i.test(txt)) return true;
    // Tên truyện kèm AI Truyện
    if (/\|\s*AI Truyện\s*$/.test(txt)) return true;
    // Chỉ chứa số, dấu gạch, dấu phẩy (không phải nội dung truyện)
    if (/^[\d\s\/\-·•:,]+$/.test(txt)) return true;
    return false;
}

/**
 * Dùng Engine.newBrowser() để render trang rồi dùng callJs() trích nội dung.
 *
 * CHIẾN LƯỢC MỚI (không phụ thuộc vào class name selector):
 *  1. Lấy TẤT CẢ thẻ <p> trong document
 *  2. Bỏ qua p nằm trong nav/footer/header/feed
 *  3. Bỏ qua p chứa link (breadcrumb)
 *  4. Filter bằng regex các pattern junk đã biết
 *  5. Chỉ lấy p đủ dài (>= 15 ký tự) là nội dung truyện thực sự
 *
 * Fallback: tìm article trong main, tách innerText theo đoạn văn (\n\n)
 *           và cũng áp dụng filter junk tương tự
 */
function loadViaNewBrowser(chapUrl) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(chapUrl, 10000);

        var jsCode = "(function(){" +

            // ─── Hàm kiểm tra junk (nhúng vào trong callJs) ───────────────
            "function isJunk(txt){" +
            "  if(!txt||txt.length<2)return true;" +
            // Tiêu đề chương
            "  if(/^(Chương|Quyển|Tập|Chapter)\\s+\\d+[:\\s·•]/i.test(txt))return true;" +
            // Nav buttons
            "  if(/^(Trang chủ|Chương trước|Chương sau|Mục lục|Thảo luận|Nghe|Công cụ)/i.test(txt))return true;" +
            // Ngày tháng
            "  if(/^\\d{1,2}\\/\\d{1,2}\\/\\d{4}/.test(txt)&&txt.length<30)return true;" +
            // Thời gian đọc
            "  if(/^\\d+\\s*(phút|giờ|giây)\\s*(đọc)?$/i.test(txt))return true;" +
            // Ngày + thời gian kết hợp
            "  if(/\\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*[·•]\\s*\\d+\\s*(phút|giờ)/.test(txt))return true;" +
            // AI badge
            "  if(/^(AI\\s|Bản AI|Đang đọc bản|AI Truyện)/i.test(txt)&&txt.length<120)return true;" +
            // Tab title: "10 • Chương 10: ..."
            "  if(/^\\d+\\s*[·•]\\s*(Chương|Quyển|Tập)/i.test(txt))return true;" +
            // Tên truyện cuối "| AI Truyện"
            "  if(/\\|\\s*AI Truyện\\s*$/.test(txt))return true;" +
            // Chỉ số/ký tự đặc biệt
            "  if(/^[\\d\\s\\/\\-·•:,]+$/.test(txt))return true;" +
            "  if(/^(convert|bản convert|bản dịch)$/i.test(txt))return true;" +
            "  return false;" +
            "}" +

            // ─── Bước 1: Lấy tất cả <p> trong document, filter junk ────────
            "var allPs=document.querySelectorAll('p');" +
            "var res=[];" +
            "for(var pi=0;pi<allPs.length;pi++){" +
            "  var p=allPs[pi];" +
            // Bỏ p có chứa link (breadcrumb, nav)
            "  if(p.querySelectorAll('a').length>0)continue;" +
            // Bỏ p nằm trong nav/footer/header/feed thông qua ancestor
            "  var anc=p.parentElement;var skip=false;" +
            "  for(var d=0;d<8&&anc;d++){" +
            "    var tag=(anc.tagName||'').toUpperCase();" +
            "    var cn=(anc.className||'').toLowerCase();" +
            "    if(tag==='NAV'||tag==='FOOTER'||tag==='HEADER'){skip=true;break;}" +
            "    if(/(feed|breadcrumb|navbar|sidebar|comment|discuss)/i.test(cn)){skip=true;break;}" +
            "    anc=anc.parentElement;" +
            "  }" +
            "  if(skip)continue;" +
            "  var txt=((p.innerText||p.textContent)||'').trim();" +
            "  if(txt.length<15)continue;" +
            "  if(isJunk(txt))continue;" +
            "  res.push('<p>'+txt+'</p>');" +
            "}" +
            "if(res.length>=2)return res.join('\\n');" +

            // ─── Fallback: Tìm article trong main, tách theo \n\n ──────────
            "var mainEl=document.querySelector('main');" +
            "var art=(mainEl&&mainEl.querySelector('article'))||document.querySelector('article');" +
            "if(!art)return '';" +
            // Clone và xóa các phần tử UI
            "var clone=art.cloneNode(true);" +
            "var rmSel='button,[role=\"button\"],[role=\"switch\"],form,script,style,svg,nav,header,footer,[aria-hidden=\"true\"],[class*=\"animate-pulse\"],[class*=\"sr-only\"]';" +
            "var rmEls=clone.querySelectorAll(rmSel);" +
            "for(var ri=rmEls.length-1;ri>=0;ri--){" +
            "  try{var rp=rmEls[ri].parentNode;if(rp)rp.removeChild(rmEls[ri]);}catch(e){}" +
            "}" +
            "var raw=((clone.innerText||clone.textContent)||'').trim();" +
            "if(raw.length<30)return '';" +
            // Tách theo đoạn văn (2+ dòng trắng) - bảo toàn đoạn
            "var blocks=raw.split(/\\n{2,}/);" +
            "res=[];" +
            "for(var bi=0;bi<blocks.length;bi++){" +
            "  var blk=blocks[bi].replace(/\\n/g,' ').trim();" +
            "  if(blk.length<15)continue;" +
            "  if(isJunk(blk))continue;" +
            "  res.push('<p>'+blk+'</p>');" +
            "}" +
            "if(res.length>=2)return res.join('\\n');" +
            // Last resort: từng dòng đủ dài
            "var lines=raw.split('\\n');" +
            "res=[];" +
            "for(var li=0;li<lines.length;li++){" +
            "  var ln=lines[li].trim();" +
            "  if(ln.length<20)continue;" +
            "  if(isJunk(ln))continue;" +
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
