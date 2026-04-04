var BASE_URL = "https://trangtruyen.site";
var API_BASE  = BASE_URL + "/api";

function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^/?#]+)/i);
    return m ? m[1] : "";
}

function isLoginRequired(text) {
    return /đăng nhập|yêu cầu đăng|cần đăng nhập|login required|sign in|unauthorized|chưa được đăng ký|Trình đọc hiện tại|đăng ký ngay|chưa đăng ký/i.test(text || "");
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

function sha256HexJS(str) {
    var K = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var msg = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) { msg.push(c); }
        else if (c < 2048) { msg.push((c>>6)|192,(c&63)|128); }
        else { msg.push((c>>12)|224,((c>>6)&63)|128,(c&63)|128); }
    }
    var l = msg.length;
    msg.push(0x80);
    while ((msg.length%64)!==56) msg.push(0);
    var bits = l*8;
    msg.push(0,0,0,0,(bits>>>24)&255,(bits>>>16)&255,(bits>>>8)&255,bits&255);
    for (var blk = 0; blk < msg.length; blk += 64) {
        var W = [];
        for (var t = 0; t < 16; t++) W[t]=(msg[blk+t*4]<<24)|(msg[blk+t*4+1]<<16)|(msg[blk+t*4+2]<<8)|msg[blk+t*4+3];
        for (var t = 16; t < 64; t++) {
            var s0=(W[t-15]>>>7|W[t-15]<<25)^(W[t-15]>>>18|W[t-15]<<14)^(W[t-15]>>>3);
            var s1=(W[t-2]>>>17|W[t-2]<<15)^(W[t-2]>>>19|W[t-2]<<13)^(W[t-2]>>>10);
            W[t]=(W[t-16]+s0+W[t-7]+s1)|0;
        }
        var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
        for (var t = 0; t < 64; t++) {
            var S1=(e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7);
            var ch=(e&f)^(~e&g);
            var t1=(h+S1+ch+K[t]+W[t])|0;
            var S0=(a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10);
            var maj=(a&b)^(a&c)^(b&c);
            var t2=(S0+maj)|0;
            h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
        }
        H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;
        H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
    }
    var hex="";
    for (var i=0;i<8;i++) hex+=('00000000'+(H[i]>>>0).toString(16)).slice(-8);
    return hex;
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
    } catch (_) {}
    try { return sha256HexJS(String(input || "")); } catch (_) { return ""; }
}

var _rsaKeyCache = null;
function generateRsaKeyPair() {
    if (_rsaKeyCache) return _rsaKeyCache;
    try {
        var KPG = Java.type("java.security.KeyPairGenerator");
        var B64 = Java.type("java.util.Base64");
        var kpg = KPG.getInstance("RSA");
        kpg.initialize(2048);
        var kp = kpg.generateKeyPair();
        var pubEncoded = kp.getPublic().getEncoded();
        var pubB64 = String(B64.getEncoder().encodeToString(pubEncoded));
        _rsaKeyCache = { privateKey: kp.getPrivate(), publicKeyB64: pubB64 };
        return _rsaKeyCache;
    } catch (e) {
        return null;
    }
}

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

function hexToBytes(hex) {
    var clean = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2 === 1) clean = "0" + clean;
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

function getManualCookie() {
    try {
        if (typeof TRANGTRUYEN_COOKIE !== "undefined" &&
            TRANGTRUYEN_COOKIE &&
            String(TRANGTRUYEN_COOKIE).length > 10) {
            return String(TRANGTRUYEN_COOKIE).trim();
        }
    } catch (_) {}
    return "";
}

function extractCookieValue(cookieStr, name) {
    if (!cookieStr || !name) return "";
    var pattern = new RegExp("(?:^|;\\s*)" + name + "=([^;]*)");
    var m = String(cookieStr).match(pattern);
    return m ? m[1] : "";
}

function getWebviewCookie() {
    try {
        var c = localCookie.getCookie();
        if (c && c.length > 5) return String(c);
    } catch (_) {}
    return "";
}

function getSiteCookie(url) {
    var manualCk = getManualCookie();
    var webviewCk = getWebviewCookie();

    if (manualCk) {
        var result = manualCk;
        if (webviewCk) {
            var cfVal = extractCookieValue(webviewCk, "cf_clearance");
            if (cfVal) {
                result = result.replace(/;\s*cf_clearance=[^;]*/gi, "").replace(/^cf_clearance=[^;]*;\s*/gi, "").trim();
                result += "; cf_clearance=" + cfVal;
            }
            if (!result.includes("_cfuvid")) {
                var cfuVal = extractCookieValue(webviewCk, "_cfuvid");
                if (cfuVal) result += "; _cfuvid=" + cfuVal;
            }
        }
        return result;
    }

    if (webviewCk) return webviewCk;

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

function hasSidCookie(cookie) {
    return cookie && /trangtruyen\.sid/.test(cookie);
}

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

function readerBootstrap(cookie, log) {
    var attemptCookies = [cookie || "", null];
    for (var ai = 0; ai < attemptCookies.length; ai++) {
        try {
            var res = fetch(API_BASE + "/auth/reader-bootstrap", {
                method: "POST",
                headers: makeHeaders(attemptCookies[ai]),
                body: JSON.stringify({})
            });
            if (log) log("bsStatus" + ai + "=" + (res ? res.code : "null"));
            if (res && res.ok) {
                var j = res.json();
                if (j) {
                    var tok = j.token || j.bootstrapToken || j.t || j.key || j.readerToken || "";
                    if (tok) return String(tok);
                    var keys = [];
                    try { for (var k in j) keys.push(k); } catch(_) {}
                    if (keys.length > 0) return "keys:" + keys.join(",");
                }
            }
        } catch (e) {
            if (log) log("bsErr" + ai + "=" + String(e).substring(0, 30));
        }
    }
    return "";
}

function fetchChapterMeta(chapterId, cookie, bootstrapToken, log) {
    var extra = {};
    if (bootstrapToken && bootstrapToken.indexOf("keys:") !== 0) {
        extra["X-Reader-Bootstrap"] = bootstrapToken;
    }
    // Thử nhiều header combinations
    var attempts = [
        // Attempt 0: Full headers + cookie
        { cookie: cookie || "", extra: extra, label: "full" },
        // Attempt 1: Minimal headers (giống browser thật)
        { cookie: cookie || "", extra: {}, label: "minimal", minimalHeaders: true },
        // Attempt 2: Không cookie
        { cookie: null, extra: extra, label: "noCookie" }
    ];
    for (var ai = 0; ai < attempts.length; ai++) {
        try {
            var headers;
            if (attempts[ai].minimalHeaders) {
                headers = {
                    "User-Agent": UserAgent.chrome(),
                    "Accept": "application/json",
                    "Referer": BASE_URL + "/"
                };
                if (attempts[ai].cookie) headers["Cookie"] = attempts[ai].cookie;
            } else {
                headers = makeHeaders(attempts[ai].cookie, attempts[ai].extra);
            }
            var res = fetch(API_BASE + "/chapters/" + chapterId, { headers: headers });
            if (log) log("chapFetch" + ai + "=" + (res ? res.code : "null"));
            if (res && res.ok) {
                var j = res.json();
                if (j) {
                    // Kiểm tra contentSession có populated không
                    var cs = j.contentSession;
                    if (cs && cs.sessionId) {
                        if (log) log("chapFetchWin=" + attempts[ai].label);
                        return j;
                    }
                    if (log) log("csType" + ai + "=" + typeof cs + ",csVal=" + JSON.stringify(cs).substring(0, 50));
                }
                // Dù contentSession null, vẫn trả về nếu đây là attempt cuối có response
                if (ai === attempts.length - 1) return j;
                // Lưu lại, tiếp tục thử
                if (!fetchChapterMeta._lastJson) fetchChapterMeta._lastJson = j;
            }
        } catch (_) {}
    }
    return fetchChapterMeta._lastJson || null;
}

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

function openSegment(chapterId, contentSession, deviceKeyId, privateKey, segmentIndex, cookie, clientCounter, bootstrapToken) {
    try {
        var ua = UserAgent.chrome();
        var uaHash = sha256Hex(ua);
        var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);
        var issuedAt = String(new Date().getTime());
        var sessionId = (contentSession && contentSession.sessionId) ? String(contentSession.sessionId) : "";
        var proofNonce = (contentSession && contentSession.proofNonce) ? String(contentSession.proofNonce) : "";
        var manifestMac = (contentSession && contentSession.manifestMac) ? String(contentSession.manifestMac) : "";
        var counter   = clientCounter != null ? String(clientCounter) : "0";
        var segIdx    = segmentIndex != null ? String(segmentIndex) : "0";
        var sessionProof = sha256Hex(proofNonce + sessionId + manifestMac);
        var payload = [sessionId, chapterId, segIdx, counter, deviceKeyId || "", issuedAt].join(":");
        var signature = (privateKey && deviceKeyId) ? rsaSign(privateKey, payload) : "";
        var body = {
            sessionId: sessionId,
            targetSegment: parseInt(segIdx, 10),
            deviceProof: deviceProof,
            uaHash: uaHash,
            clientCounter: parseInt(counter, 10),
            sessionProof: sessionProof
        };
        if (deviceKeyId) {
            body.readerDeviceId = deviceKeyId;
            body.readerDeviceIssuedAt = parseInt(issuedAt, 10);
        }
        if (signature) {
            body.readerDeviceSignature = signature;
        }
        var extraH = {
            "X-Reader-Device-Id": deviceKeyId || "",
            "X-Reader-Layout-Profile": "default",
            "X-Reader-Layout-Width": "800"
        };
        if (bootstrapToken && bootstrapToken.indexOf("keys:") !== 0) {
            extraH["X-Reader-Bootstrap"] = bootstrapToken;
        }
        var res = fetch(API_BASE + "/chapters/" + chapterId + "/segment/open", {
            method: "POST",
            headers: makeHeaders(cookie, extraH),
            body: JSON.stringify(body)
        });
        if (res && res.ok) return res.json();
        // Thử lại không cookie
        var res2 = fetch(API_BASE + "/chapters/" + chapterId + "/segment/open", {
            method: "POST",
            headers: makeHeaders(null, extraH),
            body: JSON.stringify(body)
        });
        if (res2 && res2.ok) return res2.json();
        return null;
    } catch (_) { return null; }
}

function decryptSegment(segJson, grantSecret) {
    if (!segJson) return "";
    // Direct paragraphs (Fortress-v2 plain text response)
    var paras = segJson.paragraphs || (segJson.segment && segJson.segment.paragraphs);
    if (paras && paras.length) {
        var out = [];
        for (var i = 0; i < paras.length; i++) {
            var p = cleanZeroWidth(String(paras[i] || "").trim());
            if (p) out.push("<p>" + p + "</p>");
        }
        return out.join("\n");
    }
    if (segJson.l2 && grantSecret) {
        try {
            var stage1Text = aesGcmDecryptWithIvPrefix(segJson.l2, grantSecret);
            if (!stage1Text) return "";
            var s1 = safeJsonParse(stage1Text);
            if (s1 && s1.d && s1.i && s1.g) {
                var stage2Text = aesGcmDecryptB64(s1.d, s1.i, s1.g);
                if (stage2Text) return parseContentToHtml(stage2Text);
            }
            if (s1) return parseContentToHtml(stage1Text);
            if (stage1Text.length > 80) return plainTextToHtml(stage1Text);
        } catch (_) {}
    }
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
    return "";
}

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

// ========================================================================================
// BROWSER APPROACH: Nhiều chiến lược trích xuất text từ browser rendering
// ========================================================================================

function busyWait(ms) {
    var s = new Date().getTime();
    while (new Date().getTime() - s < ms) {}
}

function tryBrowserApproach(url, log) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(url, 60000);
        log("brLaunched=1");

        // Chờ page load + JS render hoàn tất
        busyWait(12000);

        // === TEST 1: Basic JS execution ===
        var jsOk = false;
        try {
            var titleRes = browser.callJs("document.title", 3000);
            var title = String(titleRes && titleRes.text ? titleRes.text() : titleRes || "");
            log("brTitle=" + title.substring(0, 20));
            jsOk = title.length > 0;
        } catch (e) {
            log("brTitleErr=" + String(e).substring(0, 30));
        }

        if (!jsOk) {
            try { browser.close(); } catch (_) {}
            return "";
        }

        // === TEST 2: Lấy toàn bộ body text ===
        var bodyText = "";
        try {
            var btRes = browser.callJs(
                "(function(){try{return document.body.innerText||'';}catch(e){return 'err:'+e;}})()",
                8000
            );
            bodyText = String(btRes && btRes.text ? btRes.text() : btRes || "");
            log("bodyLen=" + bodyText.length);
            // Log nội dung thực tế browser thấy (để debug)
            if (bodyText.length > 0 && bodyText.length < 1000) {
                log("bodyPreview=" + bodyText.substring(0, 120).replace(/\n/g, '|'));
            }
        } catch (e) {
            log("bodyErr=" + String(e).substring(0, 30));
        }

        // Nếu body text có nội dung truyện → extract chỉ phần content
        if (bodyText.length > 200) {
            var extractedFromBody = extractStoryFromBodyText(bodyText);
            if (extractedFromBody && extractedFromBody.length > 100) {
                log("bodyExtract=" + extractedFromBody.length);
                try { browser.close(); } catch (_) {}
                return extractedFromBody;
            }
        }

        // === TEST 3: Tìm content trong DOM bằng nhiều selectors ===
        var domHtml = "";
        try {
            var domRes = browser.callJs(
                "(function(){" +
                "var sels=[" +
                "'[class*=\"chapter-content\"]','[class*=\"chapter-body\"]'," +
                "'[class*=\"reader-content\"]','[class*=\"content-render\"]'," +
                "'[class*=\"reading\"]','[class*=\"prose\"]'," +
                "'.chapter-content','#chapter-content'," +
                "'.reader-content','.chapter-body'," +
                "'article','main','[role=\"main\"]'" +
                "];" +
                "for(var i=0;i<sels.length;i++){" +
                "  try{var el=document.querySelector(sels[i]);" +
                "  if(!el)continue;" +
                "  var t=(el.innerText||'').trim();" +
                "  if(t.length>100)return JSON.stringify({sel:sels[i],text:t.substring(0,8000),len:t.length});" +
                "  }catch(e){}}" +
                "return '{}';" +
                "})()",
                8000
            );
            var domJson = safeJsonParse(String(domRes && domRes.text ? domRes.text() : domRes || ""));
            if (domJson && domJson.text && domJson.text.length > 100) {
                log("domSel=" + (domJson.sel || "?"));
                log("domLen=" + domJson.text.length);
                var extracted = extractStoryFromBodyText(domJson.text);
                if (extracted && extracted.length > 100) {
                    try { browser.close(); } catch (_) {}
                    return extracted;
                }
            }
        } catch(e) {
            log("domErr=" + String(e).substring(0, 30));
        }

        // === TEST 4: Lấy __NEXT_DATA__ (Next.js SSR data) ===
        try {
            var nextRes = browser.callJs(
                "(function(){var el=document.getElementById('__NEXT_DATA__');return el?el.textContent.substring(0,8000):''})()",
                5000
            );
            var nextText = String(nextRes && nextRes.text ? nextRes.text() : nextRes || "");
            if (nextText.length > 50) {
                log("nextDataLen=" + nextText.length);
                var nextJson = safeJsonParse(nextText);
                if (nextJson && nextJson.props && nextJson.props.pageProps) {
                    var pageProps = nextJson.props.pageProps;
                    var chapter = pageProps.chapter || pageProps.data || {};
                    if (chapter.content && chapter.content.length > 80) {
                        log("nextContent=1");
                        try { browser.close(); } catch (_) {}
                        return plainTextToHtml(chapter.content);
                    }
                }
            }
        } catch(e) {}

        // === TEST 5: Hook Canvas fillText + force re-render via scroll ===
        try {
            browser.callJs(
                "(function(){" +
                "window.__vbTexts=[];" +
                "var orig=CanvasRenderingContext2D.prototype.fillText;" +
                "CanvasRenderingContext2D.prototype.fillText=function(t,x,y){" +
                "  if(t&&t.length>1)window.__vbTexts.push({t:t,y:y});" +
                "  return orig.apply(this,arguments);" +
                "};" +
                "return 'canvasHooked';" +
                "})()",
                5000
            );
            log("canvasHook=1");

            // Force scroll toàn trang → trigger re-render
            browser.callJs("window.scrollTo(0,0)", 1000);
            busyWait(1000);

            // Scroll xuống dần dần
            for (var si = 0; si < 20; si++) {
                try {
                    browser.callJs("window.scrollBy(0,300)", 1000);
                } catch(_) {}
                busyWait(500);
            }

            // Scroll ngược lên
            browser.callJs("window.scrollTo(0,0)", 1000);
            busyWait(1000);

            // Scroll xuống lại
            for (var si2 = 0; si2 < 20; si2++) {
                try {
                    browser.callJs("window.scrollBy(0,300)", 1000);
                } catch(_) {}
                busyWait(500);
            }

            // Thu thập canvas text
            var canvasRes = browser.callJs(
                "(function(){" +
                "var t=window.__vbTexts||[];" +
                "if(!t.length)return '';" +
                "t.sort(function(a,b){return a.y-b.y;});" +
                "var lines=[];" +
                "for(var i=0;i<t.length;i++)lines.push(t[i].t);" +
                "return lines.join('\\n');" +
                "})()",
                5000
            );
            var canvasText = String(canvasRes && canvasRes.text ? canvasRes.text() : canvasRes || "");
            log("canvasTextLen=" + canvasText.length);

            if (canvasText.length > 100) {
                var html = plainTextToHtml(canvasText);
                if (isGoodContent(htmlToText(html))) {
                    try { browser.close(); } catch (_) {}
                    return html;
                }
            }
        } catch(e) {
            log("canvasErr=" + String(e).substring(0, 30));
        }

        // === TEST 6: Hook fetch/XHR + navigate to trigger reload ===
        try {
            // Install intercept hooks
            browser.callJs(
                "(function(){" +
                "window.__vbApi=[];" +
                "var of=window.fetch;" +
                "window.fetch=function(){" +
                "  var a=arguments,u=(typeof a[0]==='string')?a[0]:(a[0]&&a[0].url?a[0].url:'');" +
                "  return of.apply(this,a).then(function(r){" +
                "    if(u.indexOf('segment/open')!==-1&&r.ok){" +
                "      r.clone().text().then(function(b){window.__vbApi.push(b);}).catch(function(){});" +
                "    }" +
                "    return r;" +
                "  });" +
                "};" +
                "return 'fetchHooked';" +
                "})()",
                5000
            );
            log("fetchHook=1");

            // Trigger page reload via F5 or location reload
            try {
                browser.callJs("location.reload()", 3000);
            } catch(_) {}

            busyWait(15000);

            // Re-install hooks (page reload resets JS context)
            browser.callJs(
                "(function(){" +
                "window.__vbApi=window.__vbApi||[];" +
                "return 'api_count='+window.__vbApi.length;" +
                "})()",
                3000
            );

            // Check if any API responses were intercepted
            var apiRes = browser.callJs(
                "(function(){return JSON.stringify(window.__vbApi||[]);})()",
                5000
            );
            var apiText = String(apiRes && apiRes.text ? apiRes.text() : apiRes || "");
            log("apiInterceptLen=" + apiText.length);

            if (apiText.length > 10) {
                var apiArr = safeJsonParse(apiText);
                if (apiArr && apiArr.length > 0) {
                    var allParas = [];
                    for (var ai = 0; ai < apiArr.length; ai++) {
                        var segData = safeJsonParse(apiArr[ai]);
                        if (segData) {
                            var paras = segData.paragraphs || (segData.segment && segData.segment.paragraphs);
                            if (paras && paras.length) {
                                for (var pi = 0; pi < paras.length; pi++) {
                                    allParas.push(paras[pi]);
                                }
                            }
                        }
                    }
                    if (allParas.length > 0) {
                        var html = [];
                        for (var hi = 0; hi < allParas.length; hi++) {
                            var p = cleanZeroWidth(String(allParas[hi] || "").trim());
                            if (p) html.push("<p>" + p + "</p>");
                        }
                        var result = html.join("\n");
                        if (result.length > 100) {
                            try { browser.close(); } catch (_) {}
                            return result;
                        }
                    }
                }
            }
        } catch(e) {
            log("fetchErr=" + String(e).substring(0, 30));
        }

        // === TEST 7: Lấy toàn bộ text nodes ===
        try {
            var allTextRes = browser.callJs(
                "(function(){" +
                "var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false);" +
                "var texts=[];" +
                "while(w.nextNode()){" +
                "  var t=w.currentNode.textContent.trim();" +
                "  if(t.length>25)texts.push(t);" +
                "}" +
                "return texts.join('\\n');" +
                "})()",
                8000
            );
            var allText = String(allTextRes && allTextRes.text ? allTextRes.text() : allTextRes || "");
            log("allTextLen=" + allText.length);

            if (allText.length > 200) {
                var extracted = extractStoryFromBodyText(allText);
                if (extracted && extracted.length > 100) {
                    try { browser.close(); } catch (_) {}
                    return extracted;
                }
            }
        } catch(e) {}

        try { browser.close(); } catch (_) {}

    } catch (e) {
        log("brFatal=" + String(e).substring(0, 50));
        try { if (browser) browser.close(); } catch (__) {}
    }
    return "";
}

// Trích xuất nội dung truyện từ body text thô, lọc bỏ UI junk
function extractStoryFromBodyText(bodyText) {
    if (!bodyText || bodyText.length < 100) return "";
    var lines = bodyText.split("\n");
    var BAD = /^(Trang Truyện|Thể loại|Trang chủ|Đăng nhập|Đăng ký|Login|Sign|Menu|Home|Đọc truyện|Mục lục|Chương trước|Chương sau|Bình luận|Tải lại|Xem trang nguồn|Tìm kiếm|Danh sách|Top|Sắp xếp|Theo dõi|Thông báo|Cài đặt|Hồ sơ|Đọc tiếp|Mở|BXH|Tặng quà|Chưa có|vBook|Trước|Sau|ĐANG ĐỌC)$/i;
    var SHORT_BAD = /^(Mở|Đọc|OK|Close|×|‹|›|«|»|\d+|Chương \d+)$/i;

    var goodLines = [];
    var foundContent = false;

    for (var i = 0; i < lines.length; i++) {
        var line = cleanZeroWidth(lines[i].trim());
        if (!line) continue;
        if (line.length < 10) continue;
        if (BAD.test(line)) continue;
        if (SHORT_BAD.test(line)) continue;
        if (/^https?:\/\//.test(line)) continue;
        // Bỏ lines ngắn và trông giống UI
        if (line.length < 25 && /^\s*(Chương|Chapter|Vol|Volume|Mục|Tập)\s/i.test(line)) continue;

        // Nếu dòng > 50 ký tự → rất có thể là nội dung truyện
        if (line.length > 50) foundContent = true;

        if (foundContent || line.length > 30) {
            goodLines.push(line);
        }
    }

    if (goodLines.length < 3) return "";

    var html = [];
    for (var j = 0; j < goodLines.length; j++) {
        html.push("<p>" + goodLines[j] + "</p>");
    }
    return html.join("\n");
}


function execute(url) {
    var dbg = [];
    function log(s) { try { dbg.push(String(s)); } catch (_) {} }

    try {
        var chapterId = extractChapterId(url);
        if (!chapterId) return Response.error("Không lấy được chapter ID.");

        log("chapId=" + chapterId.substring(0, 12));

        var webviewCk = getWebviewCookie();
        var manualCk  = getManualCookie();
        var cookie    = getSiteCookie(url);
        log("manualCk=" + (manualCk ? "1" : "0"));
        log("webviewCk=" + (webviewCk ? "1" : "0"));
        log("cookieLen=" + (cookie || "").length);
        log("hasSid=" + (hasSidCookie(cookie) ? "1" : "0"));
        log("hasCf=" + (/cf_clearance/.test(cookie || "") ? "1" : "0"));

        // === BƯỚC 1: API Trực tiếp ===
        var bootstrapToken = readerBootstrap(cookie, log);
        log("bootstrap=" + (bootstrapToken ? bootstrapToken.substring(0,12) : "none"));

        fetchChapterMeta._lastJson = null;
        var apiJson = fetchChapterMeta(chapterId, cookie, bootstrapToken, log);
        log("chapApiOk=" + (apiJson ? "1" : "0"));

        if (apiJson) {
            var chapter = apiJson.chapter || {};
            var contentStr = String(chapter.content || "");
            log("contentLen=" + contentStr.length);

            // Debug: Chi tiết API response
            var apiKeys = [];
            try { for (var k in apiJson) apiKeys.push(k); } catch(_) {}
            log("apiKeys=" + apiKeys.join(","));

            // Debug requireLogin
            log("reqLogin=" + String(apiJson.requireLogin));

            // Debug contentSession chi tiết
            var rawCS = apiJson.contentSession;
            log("csRaw=" + typeof rawCS + ":" + JSON.stringify(rawCS).substring(0, 100));

            // Nếu content có nội dung trực tiếp
            var parsedContent = safeJsonParse(contentStr);
            if (contentStr && contentStr.length > 50 && !parsedContent) {
                var cleaned0 = cleanContent(contentStr);
                var text0 = htmlToText(cleaned0);
                if (isGoodContent(text0)) {
                    if (/<p[\s>]|<br/.test(cleaned0)) return Response.success(cleaned0);
                    return Response.success(plainTextToHtml(text0));
                }
            }

            // Thử Resolve+Decrypt
            var meta = apiJson.contentMetaV2 || chapter.contentMetaV2 || null;
            var grantId = "";
            if (meta) grantId = meta.grantId || meta.grantID || meta.id || meta.g || "";

            if (grantId && cookie) {
                var grantSecret = callResolveApi(chapterId, grantId, cookie);
                log("grantSecret=" + (grantSecret ? "1" : "0"));
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
                    if (decrypted && decrypted.length > 50) {
                        return Response.success(cleanContent(decrypted));
                    }
                }
            }

            // === Thử Segment API trực tiếp ===
            var contentSession = apiJson.contentSession || null;
            log("hasSession=" + (contentSession ? "1" : "0"));

            if (contentSession) {
                log("sessId=" + (contentSession.sessionId ? contentSession.sessionId.substring(0, 8) : "no"));
                log("codec=" + (contentSession.segmentCodec || "?"));
                var segCount = 0;
                if (contentSession.segments) segCount = contentSession.segments.length;
                log("segCount=" + segCount);

                var keyPair = null;
                if (canUseJavaCrypto()) {
                    keyPair = generateRsaKeyPair();
                    log("rsaKey=" + (keyPair ? "1" : "0"));
                }

                var deviceKeyId = null;
                if (keyPair && cookie) {
                    deviceKeyId = registerReaderDevice(cookie, keyPair.publicKeyB64);
                    log("devKey=" + (deviceKeyId ? deviceKeyId.substring(0, 8) : "none"));
                }

                // Thử openSegment
                if (cookie) {
                    var segResult = openSegment(chapterId, contentSession, deviceKeyId,
                        keyPair ? keyPair.privateKey : null, 0, cookie, 0, bootstrapToken);
                    log("seg0=" + (segResult ? "1" : "0"));

                    if (segResult) {
                        // Debug: xem segment trả về gì
                        var segKeys = [];
                        try { for (var sk in segResult) segKeys.push(sk); } catch(_){}
                        log("segKeys=" + segKeys.join(","));

                        var segGrantSecret = segResult.grantSecret ||
                            (segResult.session && segResult.session.grantSecret) || "";
                        var segContent = decryptSegment(segResult, segGrantSecret);
                        log("segDecLen=" + (segContent || "").length);

                        if (isGoodContent(htmlToText(segContent))) {
                            var totalSegments = segResult.totalSegments || segResult.segmentCount ||
                                (contentSession.segments ? contentSession.segments.length : 0) || 1;
                            if (totalSegments > 1) {
                                var fullHtml = segContent;
                                for (var si = 1; si < Math.min(totalSegments, 30); si++) {
                                    try {
                                        var nextSeg = openSegment(chapterId, contentSession, deviceKeyId,
                                            keyPair ? keyPair.privateKey : null, si, cookie, si, bootstrapToken);
                                        if (!nextSeg) break;
                                        var nextContent = decryptSegment(nextSeg, segGrantSecret);
                                        if (nextContent) fullHtml += "\n" + nextContent;
                                    } catch (_) { break; }
                                }
                                if (isGoodContent(htmlToText(fullHtml))) {
                                    return Response.success(cleanContent(fullHtml));
                                }
                            } else {
                                return Response.success(cleanContent(segContent));
                            }
                        }
                    }
                }
            }
        }

        // === BƯỚC 2: Browser Approach ===
        log("tryBrowser=1");
        var browserResult = tryBrowserApproach(url, log);
        log("brResult=" + (browserResult || "").length);
        if (browserResult && browserResult.length > 50) {
            return Response.success(browserResult);
        }

        // === BƯỚC 3: HTML Fetch ===
        log("tryHtml=1");
        var htmlResult = tryHtmlFetch(url, cookie);
        log("htmlLen=" + (htmlResult || "").length);
        if (htmlResult && htmlResult.length > 50) {
            return Response.success(htmlResult);
        }

        var dbgStr = "[DBG: " + dbg.join(" | ") + "]";

        return Response.error(
            "Không thể tải nội dung chương.\n\n" +
            "Thử:\n" +
            "1. Đảm bảo đã đăng nhập trong vBook browser\n" +
            "2. Nhấn Tải lại\n\n" +
            dbgStr
        );

    } catch (e) {
        return Response.error(
            "Lỗi không mong đợi: " + String((e && e.message) || e) + "\n\n" +
            "[DBG: " + dbg.join("|") + "]"
        );
    }
}
