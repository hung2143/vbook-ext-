// ============================================================
// TrangTruyen - chap.js (v4 - Cookie Injection + RSA Bypass)
// Lấy nội dung chương từ trangtruyen.site
//
// CÁCH DÙNG (nếu bị đá logout):
//   1. Mở Chrome trên PC → vào trangtruyen.site → đăng nhập
//   2. Mở DevTools (F12) → Application → Cookies → trangtruyen.site
//   3. Copy giá trị của cookie "trangtruyen.sid" (và "cf_clearance" nếu có)
//   4. Trong vBook: giữ plugin → Mã bổ sung → nhập:
//        let TRANGTRUYEN_COOKIE = "trangtruyen.sid=GIÁ_TRỊ_Ở_ĐÂY";
//   5. Nhấn OK → mở chương truyện
//
// Nếu có cả cf_clearance:
//        let TRANGTRUYEN_COOKIE = "trangtruyen.sid=ABC; cf_clearance=XYZ";
// ============================================================

var BASE_URL = "https://trangtruyen.site";
var API_BASE  = BASE_URL + "/api";

var ERROR_COOKIE_GUIDE = [
    "Session bị đá ra ngoài do trang phát hiện plugin.",
    "",
    "Cách fix: Nhập cookie thủ công qua \"Mã bổ sung\":",
    "1. Mở Chrome (PC) → vào trangtruyen.site → đăng nhập",
    "2. Nhấn F12 → Application → Cookies → trangtruyen.site",
    "3. Copy giá trị 'trangtruyen.sid'",
    "4. Giữ plugin trong vBook → Mã bổ sung → nhập:",
    "   let TRANGTRUYEN_COOKIE = \"trangtruyen.sid=GIÁ_TRỊ\"",
    "5. OK → thử lại"
].join("\n");

var ERROR_LOGIN = "Vui lòng vào trang nguồn " + BASE_URL + ", đăng nhập, rồi quay lại nhấn Tải lại.";

// ---- Utilities ----

function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^/?#]+)/i);
    return m ? m[1] : "";
}

function isLoginRequired(text) {
    return /đăng nhập|yêu cầu đăng|cần đăng nhập|login required|sign in|unauthorized/i.test(text || "");
}

function isGoodContent(text) {
    if (!text || text.length < 80) return false;
    if (isLoginRequired(text)) return false;
    return true;
}

function cleanZeroWidth(s) {
    return (s || "").replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g, "");
}

function htmlToText(html) {
    if (!html) return "";
    return String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function plainTextToHtml(text) {
    if (!text) return "";
    var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var line = cleanZeroWidth((lines[i] || "").trim());
        if (line) out.push("<p>" + line + "</p>");
    }
    return out.join("\n");
}

function cleanContent(html) {
    if (!html) return "";
    html = cleanZeroWidth(html);
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    return html;
}

// ---- Java Crypto helpers (RSA + AES-GCM) ----

function canUseJavaCrypto() {
    try {
        Java.type("javax.crypto.Cipher");
        Java.type("java.security.KeyPairGenerator");
        Java.type("java.util.Base64");
        return true;
    } catch (_) {
        return false;
    }
}

function sha256Hex(input) {
    try {
        var MD = Java.type("java.security.MessageDigest");
        var CS = Java.type("java.nio.charset.StandardCharsets");
        var md = MD.getInstance("SHA-256");
        var bytes = md.digest(new java.lang.String(String(input || "")).getBytes(CS.UTF_8));
        var sb = new java.lang.StringBuilder();
        for (var i = 0; i < bytes.length; i++) {
            var b = bytes[i]; if (b < 0) b += 256;
            var h = java.lang.Integer.toHexString(b);
            if (h.length() === 1) sb.append("0");
            sb.append(h);
        }
        return String(sb.toString());
    } catch (_) {
        return "";
    }
}

// Tạo RSA-2048 keypair, trả về {privateKey: CryptoKey, publicKeyB64: string}
var _rsaKeyCache = null;
function generateRsaKeyPair() {
    if (_rsaKeyCache) return _rsaKeyCache;
    try {
        var KPG = Java.type("java.security.KeyPairGenerator");
        var B64 = Java.type("java.util.Base64");
        var kpg = KPG.getInstance("RSA");
        kpg.initialize(2048);
        var kp = kpg.generateKeyPair();
        var pubEncoded = kp.getPublic().getEncoded(); // SPKI format
        var pubB64 = String(B64.getEncoder().encodeToString(pubEncoded));
        _rsaKeyCache = { privateKey: kp.getPrivate(), publicKeyB64: pubB64 };
        return _rsaKeyCache;
    } catch (e) {
        return null;
    }
}

// Ký payload bằng RSA-SHA256, trả về base64
function rsaSign(privateKey, payload) {
    try {
        var Sig = Java.type("java.security.Signature");
        var CS = Java.type("java.nio.charset.StandardCharsets");
        var B64 = Java.type("java.util.Base64");
        var sig = Sig.getInstance("SHA256withRSA");
        sig.initSign(privateKey);
        sig.update(new java.lang.String(String(payload)).getBytes(CS.UTF_8));
        var signed = sig.sign();
        return String(B64.getEncoder().encodeToString(signed));
    } catch (e) {
        return "";
    }
}

// AES-GCM decrypt: data=b64, iv=b64, keyB64=b64
function aesGcmDecryptB64(dataB64, ivB64, keyB64) {
    try {
        var Cipher = Java.type("javax.crypto.Cipher");
        var SKS = Java.type("javax.crypto.spec.SecretKeySpec");
        var GCM = Java.type("javax.crypto.spec.GCMParameterSpec");
        var CS  = Java.type("java.nio.charset.StandardCharsets");
        var B64 = Java.type("java.util.Base64");
        var keyBytes  = B64.getDecoder().decode(String(keyB64).replace(/\s/g,""));
        var ivBytes   = B64.getDecoder().decode(String(ivB64).replace(/\s/g,""));
        var dataBytes = B64.getDecoder().decode(String(dataB64).replace(/\s/g,""));
        var c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SKS(keyBytes, "AES"), new GCM(128, ivBytes));
        var plain = c.doFinal(dataBytes);
        return String(new java.lang.String(plain, CS.UTF_8));
    } catch (_) {
        return "";
    }
}

// AES-GCM decrypt từ raw bytes (IV 12 bytes đầu) + key là hex
function hexToBytes(hex) {
    var clean = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2 === 1) clean = "0" + clean;
    var B64 = Java.type("java.util.Base64");
    var out = Java.type("byte[]")(Math.floor(clean.length / 2));
    for (var i = 0; i < out.length; i++) {
        out[i] = java.lang.Integer.parseInt(clean.substring(i*2, i*2+2), 16);
    }
    return out;
}

function aesGcmDecryptWithIvPrefix(rawBytes_b64, keyHex) {
    try {
        var B64 = Java.type("java.util.Base64");
        var Cipher = Java.type("javax.crypto.Cipher");
        var SKS = Java.type("javax.crypto.spec.SecretKeySpec");
        var GCM = Java.type("javax.crypto.spec.GCMParameterSpec");
        var CS  = Java.type("java.nio.charset.StandardCharsets");
        var raw = B64.getDecoder().decode(String(rawBytes_b64).replace(/\s/g,""));
        if (!raw || raw.length < 28) return "";
        var iv1 = Java.type("byte[]")(12);
        var ct1 = Java.type("byte[]")(raw.length - 12);
        java.lang.System.arraycopy(raw, 0, iv1, 0, 12);
        java.lang.System.arraycopy(raw, 12, ct1, 0, raw.length - 12);
        var key = hexToBytes(keyHex);
        var c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SKS(key, "AES"), new GCM(128, iv1));
        var plain = c.doFinal(ct1);
        return String(new java.lang.String(plain, CS.UTF_8));
    } catch (_) {
        return "";
    }
}

// ---- Get Cookie ----

// Đọc cookie được inject thủ công qua "Mã bổ sung"
// Biến TRANGTRUYEN_COOKIE được set bởi người dùng trong vBook
function getManualCookie() {
    try {
        // Biến này được inject từ "Mã bổ sung" của vBook
        // Dạng: let TRANGTRUYEN_COOKIE = "trangtruyen.sid=abc; cf_clearance=xyz";
        if (typeof TRANGTRUYEN_COOKIE !== "undefined" &&
            TRANGTRUYEN_COOKIE &&
            String(TRANGTRUYEN_COOKIE).length > 10) {
            return String(TRANGTRUYEN_COOKIE).trim();
        }
    } catch (_) {}
    return "";
}

function getSiteCookie(url) {
    // Ưu tiên 1: Cookie nhập thủ công qua "Mã bổ sung"
    var manual = getManualCookie();
    if (manual) return manual;

    // Ưu tiên 2: localCookie API của vBook
    try {
        var c = localCookie.getCookie();
        if (c && c.length > 5) return String(c);
    } catch (_) {}

    // Ưu tiên 3: Cookie từ request header
    try {
        var res = fetch(BASE_URL + "/", {
            headers: { "User-Agent": UserAgent.chrome() }
        });
        if (res && res.request && res.request.headers) {
            var h = res.request.headers;
            var ck = h.cookie || h.Cookie || h["Cookie"] || "";
            if (ck && ck.length > 5) return String(ck);
        }
    } catch (_) {}

    return "";
}

// Kiểm tra cookie có chứa session hợp lệ không
function hasSidCookie(cookie) {
    return cookie && /trangtruyen\.sid/.test(cookie);
}

// ---- API Calls ----

function makeHeaders(cookie, extra) {
    var ua = UserAgent.chrome();
    var uaHash = sha256Hex(ua);
    var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);
    var h = {
        "User-Agent": ua,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": BASE_URL + "/",
        "Origin": BASE_URL,
        "X-Client-UA-Hash": uaHash,
        "X-Device-Proof": deviceProof
    };
    if (cookie) h["Cookie"] = cookie;
    if (extra) {
        for (var k in extra) h[k] = extra[k];
    }
    return h;
}

// Bước 1: Lấy chapter meta (không cần auth cho public chapters)
function fetchChapterMeta(chapterId, cookie) {
    try {
        var res = fetch(API_BASE + "/chapters/" + chapterId, {
            headers: makeHeaders(cookie)
        });
        if (!res || !res.ok) return null;
        return res.json();
    } catch (_) { return null; }
}

// Bước 2: Register reader-device (RSA)
function registerReaderDevice(cookie, publicKeyB64) {
    try {
        var res = fetch(API_BASE + "/auth/reader-device/register", {
            method: "POST",
            headers: makeHeaders(cookie),
            body: JSON.stringify({ publicKeySpki: publicKeyB64 })
        });
        if (!res || !res.ok) return null;
        var j = res.json();
        return j && j.deviceKeyId ? String(j.deviceKeyId) : null;
    } catch (_) { return null; }
}

// Bước 3: Reader bootstrap
function readerBootstrap(cookie) {
    try {
        var res = fetch(API_BASE + "/auth/reader-bootstrap", {
            method: "POST",
            headers: makeHeaders(cookie),
            body: JSON.stringify({})
        });
        if (res && res.ok) return res.json();
        return null;
    } catch (_) { return null; }
}

// Bước 4: Mở segment với RSA signature
function openSegment(chapterId, contentSession, deviceKeyId, privateKey, segmentIndex, cookie, clientCounter) {
    try {
        var ua = UserAgent.chrome();
        var uaHash = sha256Hex(ua);
        var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);
        var issuedAt = String(new Date().getTime());
        var sessionId = (contentSession && contentSession.sessionId) ? String(contentSession.sessionId) : "";
        var counter   = clientCounter != null ? String(clientCounter) : "0";
        var segIdx    = segmentIndex != null ? String(segmentIndex) : "0";

        // Payload để ký: sessionId:chapterId:segmentIndex:counter:deviceKeyId:issuedAt
        var payload = [sessionId, chapterId, segIdx, counter, deviceKeyId, issuedAt].join(":");

        // sessionProof = sha256 của sessionId:chapterId:segIdx
        var sessionProof = sha256Hex([sessionId, chapterId, segIdx].join(":"));

        var signature = privateKey ? rsaSign(privateKey, payload) : "";

        var body = {
            contentSessionId: sessionId,
            targetSegment: parseInt(segIdx, 10),
            fromSegment: -1,
            reason: "initial",
            deviceProof: deviceProof,
            uaHash: uaHash
        };
        if (deviceKeyId) {
            body.readerDeviceId = deviceKeyId;
            body.readerDeviceIssuedAt = parseInt(issuedAt, 10);
            body.sessionProof = sessionProof;
            body.clientCounter = parseInt(counter, 10);
        }
        if (signature) {
            body.readerDeviceSignature = signature;
        }

        var headers = makeHeaders(cookie, {
            "X-Reader-Device-Id": deviceKeyId || "",
            "X-Reader-Layout-Profile": "default",
            "X-Reader-Layout-Width": "800"
        });

        var res = fetch(API_BASE + "/chapters/" + chapterId + "/segment/open", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!res || !res.ok) return null;
        return res.json();
    } catch (_) { return null; }
}

// Giải mã segment response (dạng JSON từ segment/open)
function decryptSegment(segJson, grantSecret) {
    if (!segJson) return "";
    // Segment có thể có trực tiếp paragraphs
    if (segJson.paragraphs && segJson.paragraphs.length) {
        var arr = segJson.paragraphs;
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var p = cleanZeroWidth(String(arr[i] || "").trim());
            if (p) out.push("<p>" + p + "</p>");
        }
        return out.join("\n");
    }
    // Dạng encrypted {l2, ...}
    if (segJson.l2 && grantSecret) {
        try {
            var stage1Text = aesGcmDecryptWithIvPrefix(segJson.l2, grantSecret);
            if (!stage1Text) return "";
            var s1 = safeJsonParse(stage1Text);
            if (s1 && s1.d && s1.i && s1.g) {
                // Stage 2: decrypt d với iv=i, key=g (có thể là b64 key)
                var stage2Text = aesGcmDecryptB64(s1.d, s1.i, s1.g);
                if (stage2Text) return parseContentToHtml(stage2Text);
            }
            if (s1) return parseContentToHtml(stage1Text);
            if (stage1Text.length > 80) return plainTextToHtml(stage1Text);
        } catch (_) {}
    }
    // Segment dạng content string thuần
    if (segJson.content) {
        return plainTextToHtml(cleanZeroWidth(String(segJson.content)));
    }
    return "";
}

function parseContentToHtml(text) {
    if (!text) return "";
    var obj = safeJsonParse(text);
    if (obj) {
        var paragraphs = obj.paragraphs || obj.p || obj.lines || null;
        if (paragraphs && paragraphs.length) {
            var html = [];
            for (var i = 0; i < paragraphs.length; i++) {
                var p = cleanZeroWidth(String(paragraphs[i] || "").trim());
                if (p) html.push("<p>" + p + "</p>");
            }
            return html.join("\n");
        }
        if (typeof obj.content === "string" && obj.content.length > 50) {
            return plainTextToHtml(obj.content);
        }
    }
    var cleaned = cleanZeroWidth(String(text).trim());
    if (cleaned.length > 80) return plainTextToHtml(cleaned);
    return "";
}

// ---- API approach: /resolve (fallback từ v2) ----
function callResolveApi(chapterId, grantId, cookie) {
    var ua = UserAgent.chrome();
    var uaHash = sha256Hex(ua);
    var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);
    var headers = makeHeaders(cookie, {
        "x-client-ua-hash": uaHash,
        "x-device-proof": deviceProof
    });
    try {
        var res = fetch(API_BASE + "/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ grantId: grantId, deviceProof: deviceProof, uaHash: uaHash })
        });
        if (res && res.ok) {
            var j = res.json();
            if (j && j.grantSecret) return String(j.grantSecret);
        }
    } catch (_) {}
    try {
        var res2 = fetch(API_BASE + "/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: { "User-Agent": ua, "Content-Type": "application/json", "Cookie": cookie || "" },
            body: JSON.stringify({ grantId: grantId })
        });
        if (res2 && res2.ok) {
            var j2 = res2.json();
            if (j2 && j2.grantSecret) return String(j2.grantSecret);
        }
    } catch (_) {}
    return "";
}

// ---- Browser render (phương án fallback chính) ----
function tryBrowserRender(url, cookie) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        // Chờ 20 giây để RSA device binding + decrypt chạy xong
        browser.launch(url, 20000);

        var contentScript = "(function(){" +
            "var sels=['.chapter-content','#chapter-content','.reader-content','.chapter-body','.content-render','[class*=\"chapter\"]'];" +
            "for(var i=0;i<sels.length;i++){" +
            "  var n=document.querySelector(sels[i]);if(!n)continue;" +
            "  var t=(n.innerText||n.textContent||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').replace(/\\s+/g,' ').trim();" +
            "  if(t.length>150&&!/đăng nhập|login|yêu cầu đăng|chưa đăng nhập|401|403|Unauthorized/i.test(t)){return n.innerHTML||t;}" +
            "}" +
            // Thử tìm các paragraphs được render bởi React/Vue
            "var ps=document.querySelectorAll('article p,main p,.reader p');var txt='';var html='';" +
            "for(var i=0;i<ps.length;i++){var t=(ps[i].innerText||'').trim();if(t.length>10){txt+=t+' ';html+='<p>'+t+'</p>';}}" +
            "if(txt.length>200&&!/đăng nhập|login/i.test(txt))return html;" +
            "return '';})()";

        var result = "";
        try {
            var docAfter = browser.callJs(contentScript, 5000);
            if (docAfter) {
                var txt = "";
                try { txt = String(docAfter.text ? docAfter.text() : String(docAfter)).replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim(); } catch (_) { txt = String(docAfter); }
                if (txt.length > 150 && !isLoginRequired(txt)) result = txt;
            }
        } catch (_) {}

        if (!result) {
            try {
                var finalDoc = browser.html();
                if (finalDoc) {
                    var sels = [".chapter-content", "#chapter-content", ".reader-content", ".chapter-body", ".content-render"];
                    for (var i = 0; i < sels.length && !result; i++) {
                        try {
                            var node = finalDoc.select(sels[i]).first();
                            if (!node) continue;
                            var nodeText = cleanZeroWidth(String(node.text ? node.text() : "").replace(/\s+/g, " ").trim());
                            if (nodeText.length > 150 && !isLoginRequired(nodeText)) {
                                result = String(node.html ? node.html() : nodeText);
                            }
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        }

        try { browser.close(); } catch (_) {}

        if (result) {
            var cleaned = cleanContent(result);
            var text = htmlToText(cleaned);
            if (isGoodContent(text)) {
                if (/<p[\s>]|<br/.test(cleaned)) return cleaned;
                return plainTextToHtml(text);
            }
        }
    } catch (_) {
        try { if (browser) browser.close(); } catch (__) {}
    }
    return "";
}

// ---- HTML fetch fallback ----
function tryHtmlFetch(url, cookie) {
    try {
        var headers = { "User-Agent": UserAgent.chrome(), "Referer": BASE_URL + "/" };
        if (cookie) headers["Cookie"] = cookie;
        var res = fetch(url, { headers: headers });
        if (!res || !res.ok) return "";
        var doc = res.html("utf-8");
        var selList = [".chapter-content", "#chapter-content", ".reader-content", ".chapter-body", "article.chapter", "article", "main"];
        for (var si = 0; si < selList.length; si++) {
            try {
                var node = doc.select(selList[si]).first();
                if (!node) continue;
                var nodeHtml = cleanContent(node.html() || "");
                var nodeText = htmlToText(nodeHtml);
                if (isGoodContent(nodeText)) return nodeHtml;
            } catch (_) {}
        }
    } catch (_) {}
    return "";
}

// ---- Main execute ----

function execute(url) {
    var dbg = [];
    function log(s) { try { dbg.push(String(s)); } catch (_) {} }

    try {
        var chapterId = extractChapterId(url);
        if (!chapterId) return Response.error("Không lấy được chapter ID.");

        log("chapId=" + chapterId.substring(0, 12));

        // Lấy cookie để xác thực
        var manualCk = getManualCookie();
        var cookie = manualCk || getSiteCookie(url);
        log("manualCk=" + (manualCk ? "1" : "0"));
        log("hasCookie=" + (cookie ? "1" : "0"));
        log("cookieLen=" + (cookie || "").length);
        log("hasSid=" + (hasSidCookie(cookie) ? "1" : "0"));

        // ========================
        // Bước 1: Lấy chapter meta
        // ========================
        var apiJson = fetchChapterMeta(chapterId, cookie);
        log("chapApiOk=" + (apiJson ? "1" : "0"));

        if (apiJson) {
            var chapter = apiJson.chapter || {};
            var contentStr = String(chapter.content || "");
            log("contentLen=" + contentStr.length);

            // Kiểm tra nội dung không mã hóa (chương miễn phí)
            var parsedContent = safeJsonParse(contentStr);
            if (contentStr && !parsedContent) {
                var cleaned0 = cleanContent(contentStr);
                var text0 = htmlToText(cleaned0);
                if (isGoodContent(text0)) {
                    log("freeHtml=1");
                    if (/<p[\s>]|<br/.test(cleaned0)) return Response.success(cleaned0);
                    return Response.success(plainTextToHtml(text0));
                }
            }

            // ========================
            // Bước 2: Thử /resolve (API cũ v2)
            // ========================
            var meta = apiJson.contentMetaV2 || chapter.contentMetaV2 || null;
            var grantId = "";
            if (meta) grantId = meta.grantId || meta.grantID || meta.id || meta.g || "";
            log("grantId=" + (grantId ? grantId.substring(0, 12) : "none"));

            if (grantId && cookie) {
                var grantSecret = callResolveApi(chapterId, grantId, cookie);
                log("grantSecret=" + (grantSecret ? "1_len=" + grantSecret.length : "0"));

                if (grantSecret && parsedContent && parsedContent.v === 3 && parsedContent.l2 && canUseJavaCrypto()) {
                    var decrypted = "";
                    try {
                        var stage1Text = aesGcmDecryptWithIvPrefix(parsedContent.l2, grantSecret);
                        if (stage1Text) {
                            var s1 = safeJsonParse(stage1Text);
                            if (s1 && s1.d && s1.i && s1.g) {
                                var stage2Text = aesGcmDecryptB64(s1.d, s1.i, s1.g);
                                if (stage2Text) decrypted = parseContentToHtml(stage2Text);
                            } else {
                                decrypted = parseContentToHtml(stage1Text);
                            }
                        }
                    } catch (_) {}
                    log("resolveDecryptLen=" + (decrypted || "").length);
                    if (decrypted && decrypted.length > 50) {
                        return Response.success(cleanContent(decrypted));
                    }
                }
            }

            // ========================
            // Bước 3: Thử RSA Device Binding + Segment API
            // ========================
            if (cookie && canUseJavaCrypto()) {
                log("trySegmentApi=1");
                var contentSession = apiJson.contentSession || null;
                log("contentSession=" + (contentSession ? "1" : "0"));

                // Tạo RSA key pair
                var keyPair = generateRsaKeyPair();
                log("rsaKeyOk=" + (keyPair ? "1" : "0"));

                if (keyPair) {
                    // Register device
                    var deviceKeyId = registerReaderDevice(cookie, keyPair.publicKeyB64);
                    log("deviceKeyId=" + (deviceKeyId ? deviceKeyId.substring(0, 12) : "none"));

                    if (!deviceKeyId) {
                        // Thử bootstrap trước
                        var bs = readerBootstrap(cookie);
                        log("bootstrap=" + (bs ? "1" : "0"));
                        deviceKeyId = registerReaderDevice(cookie, keyPair.publicKeyB64);
                        log("deviceKeyId2=" + (deviceKeyId ? deviceKeyId.substring(0, 12) : "none"));
                    }

                    // Gọi segment/open (segment 0)
                    var segResult = openSegment(chapterId, contentSession, deviceKeyId, keyPair.privateKey, 0, cookie, 0);
                    log("segResult=" + (segResult ? "1" : "0"));

                    if (segResult) {
                        // Lấy grant secret nếu có
                        var segGrantSecret = segResult.grantSecret || (segResult.session && segResult.session.grantSecret) || "";
                        var segContent = decryptSegment(segResult, segGrantSecret);
                        log("segContentLen=" + (segContent || "").length);

                        if (isGoodContent(htmlToText(segContent))) {
                            log("segSuccess=1");
                            return Response.success(cleanContent(segContent));
                        }

                        // Nếu có nhiều segments, tiếp tục lấy
                        var totalSegments = segResult.totalSegments || segResult.segmentCount || 0;
                        if (totalSegments > 1) {
                            var fullHtml = segContent;
                            for (var si = 1; si < Math.min(totalSegments, 20); si++) {
                                try {
                                    var nextSeg = openSegment(chapterId, contentSession, deviceKeyId, keyPair.privateKey, si, cookie, si);
                                    if (!nextSeg) break;
                                    var nextContent = decryptSegment(nextSeg, segGrantSecret);
                                    if (nextContent) fullHtml += "\n" + nextContent;
                                } catch (_) { break; }
                            }
                            if (isGoodContent(htmlToText(fullHtml))) {
                                return Response.success(cleanContent(fullHtml));
                            }
                        }
                    }
                }
            }
        }

        // ========================
        // Bước 4: Browser render (ĐÃ BỎ vì bị detect)
        // - Site phát hiện WebView của app và kill session
        // - Dùng cookie thủ công từ "Mã bổ sung" thay thế
        // ========================
        // log("tryBrowser=skip");

        // ========================
        // Bước 5: HTML fetch thuần (cho chương miễn phí không JS)
        // ========================
        log("tryHtmlFetch=1");
        var htmlResult = tryHtmlFetch(url, cookie);
        log("htmlFetchLen=" + (htmlResult || "").length);
        if (htmlResult && htmlResult.length > 50) {
            return Response.success(htmlResult);
        }

        // ========================
        // Error: Hướng dẫn dùng cookie thủ công
        // ========================
        var dbgStr = "[DBG: " + dbg.join(" | ") + "]";

        if (!hasSidCookie(cookie)) {
            // Chưa có cookie hoặc cookie không có session
            return Response.error(
                ERROR_COOKIE_GUIDE + "\n\n" + dbgStr
            );
        }

        // Có cookie nhưng vẫn không lấy được → session bị kill
        return Response.error(
            "Session bị trang phát hiện và vô hiệu hoá.\n\n" +
            ERROR_COOKIE_GUIDE + "\n\n" +
            "Lưu ý: Lấy cookie khi đang đăng nhập trên Chrome PC,\n" +
            "KHÔNG dùng cookie từ app vBook (sẽ bị detect).\n\n" +
            dbgStr
        );

    } catch (e) {
        return Response.error(
            "Lỗi không mong đợi: " + String((e && e.message) || e) + "\n\n" +
            ERROR_COOKIE_GUIDE +
            "\n[DBG: " + dbg.join("|") + "]"
        );
    }
}
