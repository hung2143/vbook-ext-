var BASE_URL = "https://trangtruyen.site";
var API_BASE  = BASE_URL + "/api";

var ERROR_COOKIE_GUIDE = [
    "jey to jey97 "
].join("\n");

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

function readerBootstrap(cookie) {
    var attemptCookies = [null, cookie || ""];
    for (var ai = 0; ai < attemptCookies.length; ai++) {
        try {
            var res = fetch(API_BASE + "/auth/reader-bootstrap", {
                method: "POST",
                headers: makeHeaders(attemptCookies[ai]),
                body: JSON.stringify({})
            });
            if (res && res.ok) {
                var j = res.json();
                if (j) {
                    var tok = j.token || j.bootstrapToken || j.t || j.key || "";
                    if (tok) return String(tok);
                }
            }
        } catch (_) {}
    }
    return "";
}

function fetchChapterMeta(chapterId, cookie, bootstrapToken) {
    var extra = {};
    if (bootstrapToken) extra["X-Reader-Bootstrap"] = bootstrapToken;
    var cookieAttempts = [null, cookie || ""];
    for (var ai = 0; ai < cookieAttempts.length; ai++) {
        try {
            var res = fetch(API_BASE + "/chapters/" + chapterId, {
                headers: makeHeaders(cookieAttempts[ai], extra)
            });
            if (res && res.ok) return res.json();
        } catch (_) {}
    }
    return null;
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
        if (bootstrapToken) extraH["X-Reader-Bootstrap"] = bootstrapToken;
        var res = fetch(API_BASE + "/chapters/" + chapterId + "/segment/open", {
            method: "POST",
            headers: makeHeaders(null, extraH),
            body: JSON.stringify(body)
        });
        if (res && res.ok) return res.json();
        if (cookie) {
            var res2 = fetch(API_BASE + "/chapters/" + chapterId + "/segment/open", {
                method: "POST",
                headers: makeHeaders(cookie, extraH),
                body: JSON.stringify(body)
            });
            if (res2 && res2.ok) return res2.json();
        }
        return null;
    } catch (_) { return null; }
}

function decryptSegment(segJson, grantSecret) {

    if (!segJson) return "";

    if (segJson.paragraphs && segJson.paragraphs.length) {
        var arr = segJson.paragraphs;
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var p = cleanZeroWidth(String(arr[i] || "").trim());
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

function tryBrowserRender(url) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(url, 45000);

        var extractScript = "(function(){" +
            "var BAD=/Trang Truy\u1ec7n|Th\u1ec3 lo\u1ea1i|Trang ch\u1ee7|ch\u01b0a \u0111\u01b0\u1ee3c \u0111\u0103ng k\u00fd|Tr\u00ecnh \u0111\u1ecdc hi\u1ec7n|\u0111\u0103ng nh\u1eadp|login|\u0111\u0103ng k\u00fd ngay/i;" +
            "function isParagraph(t){return t.length>30&&!BAD.test(t);}" +
            "var sels=['[class*=chapter-content]','[class*=chapter-body]','[class*=reader-content]'," +
            "  '[class*=content-render]','.chapter-content','#chapter-content'," +
            "  '.reader-content','.chapter-body'];" +
            "for(var i=0;i<sels.length;i++){" +
            "  try{var n=document.querySelector(sels[i]);if(!n)continue;" +
            "  var ps=n.querySelectorAll('p');var html='';var cnt=0;" +
            "  for(var j=0;j<ps.length;j++){" +
            "    var t=(ps[j].innerText||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').trim();" +
            "    if(isParagraph(t)){html+='<p>'+t+'</p>';cnt++;}}" +
            "  if(cnt>=2&&html.length>100)return html;" +
            "  }catch(_){}}" +
            "var allP=document.querySelectorAll('p');var html2='';var cnt2=0;" +
            "for(var i=0;i<allP.length;i++){" +
            "  var t=(allP[i].innerText||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').trim();" +
            "  if(isParagraph(t)){html2+='<p>'+t+'</p>';cnt2++;}}" +
            "return cnt2>=3?html2:'';" +
            "})()";

        var result = "";
        var attempts = [10000, 20000];
        for (var ai = 0; ai < attempts.length && !result; ai++) {
            try {
                var wait = attempts[ai];
                var __start = new Date().getTime();
                while (new Date().getTime() - __start < wait) {}
            } catch (_) {}
            try {
                var r = browser.callJs(extractScript, 10000);
                if (r) {
                    var s = String(r.text ? r.text() : r).trim();
                    if (s && s.length > 100 && !isLoginRequired(s)) result = s;
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

        var bootstrapToken = readerBootstrap(cookie);
        log("bootstrap=" + (bootstrapToken ? bootstrapToken.substring(0,8) : "none"));

        var apiJson = fetchChapterMeta(chapterId, cookie, bootstrapToken);
        log("chapApiOk=" + (apiJson ? "1" : "0"));

        if (apiJson) {
            var chapter = apiJson.chapter || {};
            var contentStr = String(chapter.content || "");
            log("contentLen=" + contentStr.length);

            var parsedContent = safeJsonParse(contentStr);
            if (contentStr && !parsedContent) {
                var cleaned0 = cleanContent(contentStr);
                var text0 = htmlToText(cleaned0);
                if (isGoodContent(text0)) {
                    if (/<p[\s>]|<br/.test(cleaned0)) return Response.success(cleaned0);
                    return Response.success(plainTextToHtml(text0));
                }
            }

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

            if (cookie) {
                var hasJavaCrypto = canUseJavaCrypto();
                log("trySegmentApi=1");
                log("hasJavaCrypto=" + (hasJavaCrypto?"1":"0"));
                var contentSession = apiJson.contentSession || (apiJson.data && apiJson.data.contentSession) || null;
                var apiKeys = [];
                try { for (var k in apiJson) apiKeys.push(k); } catch(_) {}
                log("apiKeys=" + apiKeys.join(","));
                log("contentSession=" + (contentSession ? "1" : "0"));
                if (contentSession) {
                    log("sessionId=" + (contentSession.sessionId ? contentSession.sessionId.substring(0,8) : "none"));
                    log("codec=" + (contentSession.segmentCodec || "?"));
                }

                var keyPair = generateRsaKeyPair();
                log("rsaKeyOk=" + (keyPair ? "1" : "0"));

                if (keyPair) {
                    var deviceKeyId = registerReaderDevice(cookie, keyPair.publicKeyB64);
                    log("deviceKeyId=" + (deviceKeyId ? deviceKeyId.substring(0, 12) : "none"));

                    if (!deviceKeyId) {
                        var bs = readerBootstrap(cookie);
                        log("bootstrap=" + (bs ? "1" : "0"));
                        deviceKeyId = registerReaderDevice(cookie, keyPair.publicKeyB64);
                        log("deviceKeyId2=" + (deviceKeyId ? deviceKeyId.substring(0, 12) : "none"));
                    }

                    var segResult = openSegment(chapterId, contentSession, deviceKeyId, keyPair ? keyPair.privateKey : null, 0, cookie, 0, bootstrapToken);
                    log("segResult=" + (segResult ? "1" : "0"));

                    if (segResult) {
                        var segGrantSecret = segResult.grantSecret || (segResult.session && segResult.session.grantSecret) || "";
                        var segContent = decryptSegment(segResult, segGrantSecret);
                        log("segContentLen=" + (segContent || "").length);

                        if (isGoodContent(htmlToText(segContent))) {
                            return Response.success(cleanContent(segContent));
                        }

                        var totalSegments = segResult.totalSegments || segResult.segmentCount || 0;
                        if (totalSegments > 1) {
                            var fullHtml = segContent;
                            for (var si = 1; si < Math.min(totalSegments, 20); si++) {
                                try {
                                    var nextSeg = openSegment(chapterId, contentSession, deviceKeyId, keyPair ? keyPair.privateKey : null, si, cookie, si, bootstrapToken);
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

        log("tryHtmlFetch=1");
        var htmlResult = tryHtmlFetch(url, cookie);
        log("htmlFetchLen=" + (htmlResult || "").length);
        if (htmlResult && htmlResult.length > 50) {
            return Response.success(htmlResult);
        }

        log("tryBrowser=1");
        var browserResult = tryBrowserRender(url);
        log("browserLen=" + (browserResult || "").length);
        if (browserResult && browserResult.length > 50) {
            return Response.success(browserResult);
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
            ERROR_COOKIE_GUIDE +
            "\n[DBG: " + dbg.join("|") + "]"
        );
    }
}
