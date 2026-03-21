function cleanHtml(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    return html;
}

function htmlToText(html) {
    if (!html) return "";
    return String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isReadableHtml(html) {
    if (!html) return false;
    if (!/<p[\s>]|<br\s*\/?\s*>|<div[^>]*chapter|<article[\s>]/i.test(html)) return false;
    var text = htmlToText(html);
    if (!text || text.length < 30) return false;
    if (/^(đăng nhập|login|sign in)$/i.test(text)) return false;
    if (/Trang\s*Truyện\s*Đọc\s*nhanh|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(text)) return false;
    return true;
}

function plainTextToHtml(text) {
    if (!text) return "";
    var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/g);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
        var line = (lines[i] || "").trim();
        if (!line) continue;
        out.push("<p>" + line + "</p>");
    }
    return out.join("\n");
}

function isCipherLikeContent(html) {
    var s = htmlToText(html || "").replace(/\s+/g, " ").trim();
    if (!s || s.length < 40) return false;
    if (/"v"\s*:\s*\d+/i.test(s) && /"l2"\s*:/i.test(s) && /[A-Za-z0-9+/=]{120,}/.test(s)) return true;
    if (/\{[^{}]*"v"\s*:\s*\d+[^{}]*"l2"\s*:/i.test(s) && /[A-Za-z0-9+/=]{120,}/.test(s)) return true;
    if (/"l2"\s*:\s*"[A-Za-z0-9+/=]{200,}"/i.test(s)) return true;
    return false;
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^\/?#]+)/i);
    return m ? m[1] : "";
}

var BASE_SOURCE = "https://trangtruyen.site";
var ERROR_MESSAGE = "Vui lòng vào trang nguồn " + BASE_SOURCE + ", đăng nhập rồi quay lại tải lại chương để đọc tiếp.";
var AUTH_RETRY_KEY = "trangtruyen_auth_retry";
var AUTH_RETRY_TTL_MS = 10 * 60 * 1000;

function buildTrangTruyenHeaders(extra) {
    var headers = {
        "User-Agent": UserAgent.chrome(),
        "Referer": "https://trangtruyen.site/"
    };

    try {
        var cookie = localCookie.getCookie();
        if (cookie) {
            headers["Cookie"] = cookie;
            headers["cookie"] = cookie;
        }
    } catch (_) {
    }

    try {
        var token =
            localStorage.getItem("trangtruyen_token") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("token") ||
            "";
        if (token) {
            var auth = /^Bearer\s+/i.test(token) ? token : ("Bearer " + token);
            headers["Authorization"] = auth;
            headers["authorization"] = auth;
        }
    } catch (_) {
    }

    if (extra) {
        for (var k in extra) {
            if (!extra.hasOwnProperty(k)) continue;
            headers[k] = extra[k];
        }
    }

    return headers;
}

function extractRequestCookie(response) {
    try {
        if (!response || !response.request || !response.request.headers) return "";
        var h = response.request.headers;
        return String(h.cookie || h.Cookie || "");
    } catch (_) {
        return "";
    }
}

function parseCookieValue(cookie, key) {
    if (!cookie || !key) return "";
    var re = new RegExp("(?:^|;\\s*)" + key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&") + "=([^;]+)", "i");
    var m = String(cookie).match(re);
    return m ? String(m[1] || "") : "";
}

function extractTokenFromCookie(cookie) {
    if (!cookie) return "";
    var keys = [
        "accessToken",
        "access_token",
        "token",
        "authToken",
        "auth_token",
        "jwt",
        "id_token"
    ];
    for (var i = 0; i < keys.length; i++) {
        var v = parseCookieValue(cookie, keys[i]);
        if (v) return v;
    }
    return "";
}

function buildApiAuthHeaders(token, cookie) {
    var h = {};
    if (cookie) {
        h["Cookie"] = cookie;
        h["cookie"] = cookie;
    }
    if (token) {
        var auth = /^Bearer\s+/i.test(token) ? token : ("Bearer " + token);
        h["Authorization"] = auth;
        h["authorization"] = auth;
        h["x-access-token"] = token;
        h["x-auth-token"] = token;
    }
    return h;
}

function getSessionCookie(url) {
    var cookie = "";

    try {
        cookie = localCookie.getCookie() || "";
    } catch (_) {
    }
    if (cookie) return cookie;

    try {
        var probe = fetch(url, { headers: buildTrangTruyenHeaders() });
        cookie = extractRequestCookie(probe);
    } catch (_) {
    }
    if (cookie) return cookie;

    return cookie || "";
}

function readBrowserRuntimeValue(browser, script) {
    if (!browser || !script) return "";
    var fnNames = ["evaluate", "executeScript", "runScript", "eval"];
    for (var i = 0; i < fnNames.length; i++) {
        var fn = fnNames[i];
        try {
            if (typeof browser[fn] !== "function") continue;
            var out = browser[fn](script);
            if (out !== undefined && out !== null) {
                var s = String(out || "");
                if (s) return s;
            }
        } catch (_) {
        }
    }
    return "";
}

function bootstrapAuthFromBrowser(url) {
    var browser = null;
    var cookie = "";
    var token = "";
    var html = "";
    var text = "";

    var launchUrls = [
        String(url || BASE_SOURCE),
        String(url || BASE_SOURCE) + (String(url || BASE_SOURCE).indexOf("?") >= 0 ? "&" : "?") + "vbook_rt=" + Date.now()
    ];

    try {
        browser = Engine.newBrowser();

        for (var i = 0; i < launchUrls.length; i++) {
            try {
                browser.launch(launchUrls[i], 12000);
            } catch (_) {
            }

            if (!cookie) {
                cookie = readBrowserRuntimeValue(browser,
                    "(function(){try{return document.cookie||'';}catch(e){return '';}})()"
                ) || "";
            }

            if (!token) {
                token = readBrowserRuntimeValue(browser,
                    "(function(){try{" +
                    "var ks=['trangtruyen_token','accessToken','access_token','token','authToken','auth_token','jwt'];" +
                    "for(var i=0;i<ks.length;i++){var v=localStorage.getItem(ks[i]);if(v)return v;}" +
                    "return '';" +
                    "}catch(e){return '';}})()"
                ) || "";
            }

            if (!html) {
                html = readBrowserRuntimeValue(browser,
                    "(function(){try{" +
                    "var sels=['.chapter-content','.reader-content','.chapter-body','#chapter-content','#reader-content','#chapter-body','[data-chapter-content]','[data-reader-content]','article','main'];" +
                    "for(var i=0;i<sels.length;i++){var n=document.querySelector(sels[i]);if(n&&n.innerHTML&&n.innerHTML.length>80)return n.innerHTML;}" +
                    "return (document.body&&document.body.innerHTML)||'';" +
                    "}catch(e){return '';}})()"
                ) || "";
            }

            if (!text) {
                text = readBrowserRuntimeValue(browser,
                    "(function(){try{" +
                    "var sels=['.chapter-content','.reader-content','.chapter-body','#chapter-content','#reader-content','#chapter-body','[data-chapter-content]','[data-reader-content]','article','main'];" +
                    "for(var i=0;i<sels.length;i++){var n=document.querySelector(sels[i]);if(n){var t=(n.innerText||n.textContent||'').replace(/\\s+/g,' ').trim();if(t.length>120)return t;}}" +
                    "return ((document.body&&document.body.innerText)||'').replace(/\\s+/g,' ').trim();" +
                    "}catch(e){return '';}})()"
                ) || "";
            }

            if (token && (html || text)) break;
        }
    } catch (_) {
    }

    try {
        if (browser) browser.close();
    } catch (_) {
    }

    if (!token && cookie) {
        token = extractTokenFromCookie(cookie);
    }

    return {
        cookie: String(cookie || ""),
        token: String(token || ""),
        html: String(html || ""),
        text: String(text || "")
    };
}

function hasAnyAuthCredential() {
    try {
        var cookie = localCookie.getCookie();
        if (cookie && /(?:session|token|auth|jwt|user)/i.test(cookie)) return true;
    } catch (_) {
    }

    try {
        var token =
            localStorage.getItem("trangtruyen_token") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("token") ||
            "";
        if (token) return true;
    } catch (_) {
    }

    return false;
}

function markAuthRetryNeeded() {
    try {
        localStorage.setItem(AUTH_RETRY_KEY, String(Date.now()));
    } catch (_) {
    }
}

function clearAuthRetryNeeded() {
    try {
        localStorage.removeItem(AUTH_RETRY_KEY);
    } catch (_) {
    }
}

function isAuthRetryNeeded() {
    try {
        var v = localStorage.getItem(AUTH_RETRY_KEY);
        if (!v) return false;
        var ts = parseInt(v, 10);
        if (isNaN(ts)) return false;
        if (Date.now() - ts > AUTH_RETRY_TTL_MS) {
            localStorage.removeItem(AUTH_RETRY_KEY);
            return false;
        }
        return true;
    } catch (_) {
        return false;
    }
}

function forceRefreshSession(url) {
    var cookie = "";
    var token = "";

    try {
        var browser = Engine.newBrowser();
        browser.launch((url || BASE_SOURCE) + (String(url || BASE_SOURCE).indexOf("?") >= 0 ? "&" : "?") + "vbook_sync=" + Date.now(), 5000);
        browser.close();
    } catch (_) {
    }

    try {
        cookie = localCookie.getCookie() || "";
    } catch (_) {
    }

    if (!cookie) {
        try {
            var probe = fetch((url || BASE_SOURCE) + (String(url || BASE_SOURCE).indexOf("?") >= 0 ? "&" : "?") + "vbook_probe=" + Date.now(), {
                headers: buildTrangTruyenHeaders()
            });
            cookie = extractRequestCookie(probe);
        } catch (_) {
        }
    }

    token = extractTokenFromCookie(cookie);
    if (!token) {
        try {
            token =
                localStorage.getItem("trangtruyen_token") ||
                localStorage.getItem("accessToken") ||
                localStorage.getItem("token") ||
                "";
        } catch (_) {
            token = "";
        }
    }

    return { cookie: cookie || "", token: token || "" };
}

function canUseJavaCrypto() {
    try {
        Java.type("java.security.MessageDigest");
        Java.type("javax.crypto.Cipher");
        Java.type("java.util.Base64");
        return true;
    } catch (_) {
        return false;
    }
}

function sha256Hex(input) {
    var MessageDigest = Java.type("java.security.MessageDigest");
    var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");
    var md = MessageDigest.getInstance("SHA-256");
    var bytes = md.digest(new java.lang.String(String(input || "")).getBytes(StandardCharsets.UTF_8));
    var sb = new java.lang.StringBuilder();
    for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i];
        if (b < 0) b += 256;
        var h = java.lang.Integer.toHexString(b);
        if (h.length() === 1) sb.append("0");
        sb.append(h);
    }
    return String(sb.toString());
}

function decodeBase64Bytes(s) {
    var Base64 = Java.type("java.util.Base64");
    return Base64.getDecoder().decode(String(s || ""));
}

function hexToBytes(hex) {
    var clean = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2 === 1) clean = "0" + clean;
    var out = Java.type("byte[]")(Math.floor(clean.length / 2));
    for (var i = 0; i < out.length; i++) {
        out[i] = java.lang.Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function concatBytes(a, b) {
    var out = Java.type("byte[]")(a.length + b.length);
    java.lang.System.arraycopy(a, 0, out, 0, a.length);
    java.lang.System.arraycopy(b, 0, out, a.length, b.length);
    return out;
}

function aesGcmDecryptBase64Parts(part1, ivPart, part2, keyHex) {
    var Cipher = Java.type("javax.crypto.Cipher");
    var SecretKeySpec = Java.type("javax.crypto.spec.SecretKeySpec");
    var GCMParameterSpec = Java.type("javax.crypto.spec.GCMParameterSpec");
    var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");

    var p1 = decodeBase64Bytes(part1);
    var iv = decodeBase64Bytes(ivPart);
    var p2 = decodeBase64Bytes(part2);
    var all = concatBytes(p1, p2);
    var key = hexToBytes(keyHex);

    var cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
    var plain = cipher.doFinal(all);
    return String(new java.lang.String(plain, StandardCharsets.UTF_8));
}

function pickFirstValue(obj, names) {
    if (!obj) return "";
    for (var i = 0; i < names.length; i++) {
        var k = names[i];
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]) !== "") return String(obj[k]);
    }
    return "";
}

function collectValueCandidates(obj) {
    var vals = [];
    if (!obj) return vals;
    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        var v = obj[k];
        if (v === undefined || v === null) continue;
        if (typeof v === "string" || typeof v === "number") {
            var s = String(v);
            if (s) vals.push(s);
        }
    }
    return vals;
}

function deriveKeyHexes(resolveObj, metaObj, maxKeys) {
    var rVals = collectValueCandidates(resolveObj);
    var mVals = collectValueCandidates(metaObj);
    var out = [];
    var seen = {};

    for (var i = 0; i < rVals.length; i++) {
        for (var j = 0; j < mVals.length; j++) {
            for (var k = 0; k < mVals.length; k++) {
                var candidates = [
                    rVals[i] + ":" + mVals[j] + ":" + mVals[k],
                    rVals[i] + ":" + mVals[j] + mVals[k],
                    rVals[i] + mVals[j] + ":" + mVals[k],
                    rVals[i] + mVals[j] + mVals[k]
                ];
                for (var t = 0; t < candidates.length; t++) {
                    var h = sha256Hex(candidates[t]);
                    if (seen[h]) continue;
                    seen[h] = true;
                    out.push(h);
                    if (maxKeys && out.length >= maxKeys) return out;
                }
            }
        }
    }
    return out;
}

function extractCipherObject(text) {
    var s = htmlToText(text || "");
    var start = s.indexOf("{");
    var end = s.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    var raw = s.substring(start, end + 1);
    try {
        var obj = JSON.parse(raw);
        return obj && obj.l2 ? obj : null;
    } catch (_) {
        return null;
    }
}

function normalizeParagraphs(payload) {
    if (!payload) return [];
    if (payload.paragraphs && payload.paragraphs.length) return payload.paragraphs;
    if (payload.p && payload.p.length) return payload.p;
    if (payload.lines && payload.lines.length) return payload.lines;
    if (payload.content && typeof payload.content === "string") return [payload.content];
    if (typeof payload === "string") return [payload];
    return [];
}

function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    } catch (_) {
        return null;
    }
}

function findFirstKeyDeep(obj, keyName) {
    if (!obj || typeof obj !== "object") return null;
    if (obj.hasOwnProperty && obj.hasOwnProperty(keyName)) return obj[keyName];

    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var hitArr = findFirstKeyDeep(obj[i], keyName);
            if (hitArr !== null && hitArr !== undefined) return hitArr;
        }
        return null;
    }

    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        var v = obj[k];
        if (v && typeof v === "object") {
            var hit = findFirstKeyDeep(v, keyName);
            if (hit !== null && hit !== undefined) return hit;
        }
    }
    return null;
}

function findChapterIdDeep(obj) {
    if (!obj || typeof obj !== "object") return "";

    if (obj.chapter && obj.chapter.id) return String(obj.chapter.id);
    if (obj.id && /^[a-f0-9]{16,}$/i.test(String(obj.id))) return String(obj.id);

    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var idArr = findChapterIdDeep(obj[i]);
            if (idArr) return idArr;
        }
        return "";
    }

    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        var v = obj[k];
        if (v && typeof v === "object") {
            var id = findChapterIdDeep(v);
            if (id) return id;
        }
    }
    return "";
}

function extractScriptText(scriptNode) {
    if (!scriptNode) return "";
    var out = "";
    try { out = scriptNode.data() || ""; } catch (_) {}
    if (!out) {
        try { out = scriptNode.html() || ""; } catch (_) {}
    }
    if (!out) {
        try { out = scriptNode.text() || ""; } catch (_) {}
    }
    return String(out || "");
}

function extractCipherMetaFromPage(doc, fallbackChapterId) {
    if (!doc) return { cipherText: "", contentMetaV2: null, chapterId: fallbackChapterId || "" };

    var scripts = doc.select("script");
    var bestCipher = "";
    var bestMeta = null;
    var bestChapterId = "";

    for (var i = 0; i < scripts.size(); i++) {
        var scriptText = extractScriptText(scripts.get(i));
        if (!scriptText) continue;
        if (scriptText.length < 20) continue;

        if (/contentMetaV2|grantId|"l2"\s*:/i.test(scriptText)) {
            var parsed = safeJsonParse(scriptText);
            if (parsed) {
                var meta = findFirstKeyDeep(parsed, "contentMetaV2");
                if (!bestMeta && meta && typeof meta === "object") bestMeta = meta;

                var chapterObj = findFirstKeyDeep(parsed, "chapter");
                if (chapterObj && chapterObj.content && isCipherLikeContent(chapterObj.content)) {
                    bestCipher = String(chapterObj.content);
                }

                var idFromParsed = findChapterIdDeep(parsed);
                if (!bestChapterId && idFromParsed) bestChapterId = idFromParsed;
            }

            if (!bestMeta) {
                var metaMatch = scriptText.match(/"contentMetaV2"\s*:\s*(\{[\s\S]*?\})\s*(,|\})/i);
                if (metaMatch) {
                    var mObj = safeJsonParse(metaMatch[1]);
                    if (mObj && typeof mObj === "object") bestMeta = mObj;
                }
            }
        }

        if (!bestCipher) {
            var maybeCipher = extractCipherObject(scriptText);
            if (maybeCipher && maybeCipher.l2) {
                bestCipher = JSON.stringify(maybeCipher);
            }
        }
    }

    return {
        cipherText: bestCipher || "",
        contentMetaV2: bestMeta || null,
        chapterId: bestChapterId || fallbackChapterId || ""
    };
}

function paragraphsToHtml(paragraphs) {
    if (!paragraphs || !paragraphs.length) return "";
    var html = [];
    for (var i = 0; i < paragraphs.length; i++) {
        var p = (paragraphs[i] || "").trim();
        if (!p) continue;
        html.push("<p>" + p + "</p>");
    }
    return html.join("\n");
}

function tryDecryptCipherContent(chapterId, cipherText, contentMeta, forcedCookie, forcedToken) {
    if (!canUseJavaCrypto()) return "";
    if (!chapterId || !cipherText || !contentMeta) return "";

    var enc = extractCipherObject(cipherText);
    if (!enc || !enc.l2) return "";

    var grantId = pickFirstValue(contentMeta, ["grantId", "grantID", "id", "g", "gid"]);
    if (!grantId) return "";

    var ua = UserAgent.chrome() || "";
    var deviceProof = "fallback-" + sha256Hex([ua, "vi-VN", "0", "0", "UTC"].join("|")).substring(0, 32);
    var uaHash = sha256Hex(ua);

    var resolveRes = fetch("https://trangtruyen.site/api/chapters/" + chapterId + "/resolve", {
        method: "POST",
        headers: buildTrangTruyenHeaders({
            "user-agent": ua,
            "content-type": "application/json",
            "x-device-proof": deviceProof,
            "x-client-ua-hash": uaHash,
            "origin": "https://trangtruyen.site",
            "Cookie": forcedCookie || "",
            "cookie": forcedCookie || "",
            "Authorization": forcedToken ? ((/^Bearer\s+/i.test(forcedToken) ? forcedToken : ("Bearer " + forcedToken))) : "",
            "authorization": forcedToken ? ((/^Bearer\s+/i.test(forcedToken) ? forcedToken : ("Bearer " + forcedToken))) : "",
            "x-access-token": forcedToken || "",
            "x-auth-token": forcedToken || ""
        }),
        body: JSON.stringify({ grantId: grantId, deviceProof: deviceProof, uaHash: uaHash })
    });
    if (!resolveRes.ok) return "";

    var resolveObj;
    try {
        resolveObj = resolveRes.json();
    } catch (_) {
        return "";
    }
    if (!resolveObj) return "";

    var b64 = [];
    for (var k in enc) {
        if (!enc.hasOwnProperty(k) || k === "l2" || k === "v") continue;
        var v = String(enc[k] || "");
        if (/^[A-Za-z0-9+/=]{16,}$/.test(v)) b64.push(v);
    }
    if (b64.length < 2) return "";

    var keys = deriveKeyHexes(resolveObj, contentMeta, 120);
    if (!keys.length) return "";

    var stage1 = null;
    for (var i = 0; i < keys.length && !stage1; i++) {
        for (var a = 0; a < b64.length && !stage1; a++) {
            for (var b = 0; b < b64.length && !stage1; b++) {
                if (a === b) continue;
                try {
                    var t1 = aesGcmDecryptBase64Parts(enc.l2, b64[a], b64[b], keys[i]);
                    var o1 = JSON.parse(t1);
                    if (o1 && o1.d && o1.i && o1.g) stage1 = o1;
                } catch (_) {
                }
            }
        }
    }
    if (!stage1) return "";

    for (var j = 0; j < keys.length; j++) {
        try {
            var t2 = aesGcmDecryptBase64Parts(stage1.d, stage1.i, stage1.g, keys[j]);
            var o2 = JSON.parse(t2);
            var ps = normalizeParagraphs(o2);
            if (ps && ps.length) return paragraphsToHtml(ps);
        } catch (_) {
        }
    }

    return "";
}

function tryApiContent(url, forcedCookie, forcedToken) {
    var chapterId = extractChapterId(url);
    if (!chapterId) return { content: "", requireLogin: false, chapterId: "", contentMetaV2: null };

    var response = fetch("https://trangtruyen.site/api/chapters/" + chapterId, {
        headers: buildTrangTruyenHeaders(buildApiAuthHeaders(forcedToken, forcedCookie))
    });
    if (!response.ok) return { content: "", requireLogin: false, chapterId: chapterId, contentMetaV2: null };

    var json = response.json();
    if (!json || !json.chapter) return { content: "", requireLogin: false, chapterId: chapterId, contentMetaV2: null };

    var content = cleanHtml(json.chapter.content || "");
    if (content && content.indexOf("<") < 0) {
        content = plainTextToHtml(content);
    }

    return {
        content: content,
        requireLogin: !!json.requireLogin,
        chapterId: String((json.chapter && json.chapter.id) || chapterId || ""),
        contentMetaV2: json.contentMetaV2 || null
    };
}

function extractHtmlContent(doc) {
    var selectors = [
        ".chapter-content",
        ".reader-content",
        ".chapter-body",
        "article .chapter-content",
        "main .chapter-content",
        ".content .chapter-content"
    ];

    for (var i = 0; i < selectors.length; i++) {
        var node = doc.select(selectors[i]).first();
        if (!node) continue;
        var html = cleanHtml(node.html() || "");
        if (isReadableHtml(html)) return html;

        // Some chapters are rendered as plain text blocks without paragraph tags.
        var blockText = (node.text() || "").replace(/\s+/g, " ").trim();
        if (blockText.length > 180 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(blockText)) {
            return plainTextToHtml(blockText);
        }
    }
    return "";
}

function extractChapterFromRawHtml(rawHtml) {
    if (!rawHtml) return "";
    var html = String(rawHtml || "");

    var patterns = [
        /<div[^>]*class=["'][^"']*chapter-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class=["'][^"']*reader-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class=["'][^"']*chapter-body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<main[^>]*>([\s\S]*?)<\/main>/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = html.match(patterns[i]);
        if (!m || !m[1]) continue;
        var cleaned = cleanHtml(m[1]);
        if (isReadableHtml(cleaned) && !isCipherLikeContent(cleaned)) {
            return cleaned;
        }

        var cleanedText = htmlToText(cleaned || "");
        if (cleanedText.length > 200 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(cleanedText)) {
            return plainTextToHtml(cleanedText);
        }
    }

    var allText = htmlToText(html || "");
    if (allText.length > 300 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(allText)) {
        return plainTextToHtml(allText);
    }

    return "";
}

function getUrlSpecificDomSelectors(url) {
    var u = String(url || "");
    var selectors = [
        ".chapter-content",
        ".reader-content",
        ".chapter-body",
        "#chapter-content",
        "#reader-content",
        "#chapter-body",
        "[data-chapter-content]",
        "[data-reader-content]",
        "article .chapter-content",
        "main .chapter-content"
    ];

    if (/\/read\//i.test(u)) {
        selectors = selectors.concat([
            ".novel-content",
            ".reading-content",
            ".chapter-detail__content",
            ".content-chapter",
            ".entry-content",
            ".prose",
            "main article",
            "article"
        ]);
    }

    if (/trangtruyen\.site/i.test(u)) {
        selectors = selectors.concat([
            "div[class*='chapter'][class*='content']",
            "div[class*='reader'][class*='content']",
            "div[class*='reading'][class*='content']",
            "div[id*='chapter'][id*='content']"
        ]);
    }

    return selectors;
}

function getBrowserSelectorResult(browser, selector, mode) {
    if (!browser || !selector) return "";
    var fnNames = ["evaluate", "executeScript", "runScript", "eval"];
    var script = "(function(){var n=document.querySelector(" + JSON.stringify(String(selector)) + ");if(!n)return '';return " +
        (mode === "text"
            ? "(n.innerText||n.textContent||'');"
            : "(n.innerHTML||'');") +
        "})()";

    for (var i = 0; i < fnNames.length; i++) {
        var fn = fnNames[i];
        try {
            if (typeof browser[fn] !== "function") continue;
            var out = browser[fn](script);
            if (out !== undefined && out !== null) {
                var s = String(out || "");
                if (s) return s;
            }
        } catch (_) {
        }
    }

    return "";
}

function extractFromBrowserDomBySelectors(browser, url) {
    var selectors = getUrlSpecificDomSelectors(url);

    for (var i = 0; i < selectors.length; i++) {
        var selector = selectors[i];

        var html = getBrowserSelectorResult(browser, selector, "html");
        if (html) {
            var cleaned = cleanHtml(html);
            if (isReadableHtml(cleaned) && !isCipherLikeContent(cleaned)) {
                return cleaned;
            }

            var txtFromHtml = htmlToText(cleaned || "");
            if (txtFromHtml.length > 200 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(txtFromHtml)) {
                return plainTextToHtml(txtFromHtml);
            }
        }

        var text = getBrowserSelectorResult(browser, selector, "text");
        if (text) {
            var normalized = String(text || "").replace(/\s+/g, " ").trim();
            if (normalized.length > 220 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(normalized)) {
                return plainTextToHtml(normalized);
            }
        }
    }

    return "";
}

function extractFromBrowserDomHeuristic(browser) {
    if (!browser) return "";

    var fnNames = ["evaluate", "executeScript", "runScript", "eval"];
    var script = "(function(){" +
        "function badText(s){if(!s)return true;return /Yeu\\s*cau\\s*dang\\s*nhap|Yêu\\s*cầu\\s*đăng\\s*nhập|Ban\\s*can\\s*dang\\s*nhap|Bạn\\s*cần\\s*đăng\\s*nhập|Dang\\s*nhap|Đăng\\s*nhập|Login|Mã\\s*chương\\s*không\\s*hợp\\s*lệ/i.test(s);}" +
        "function scoreNode(n){if(!n)return 0;var t=(n.innerText||n.textContent||'').replace(/\\s+/g,' ').trim();if(t.length<120)return 0;if(badText(t))return 0;var pCount=(n.querySelectorAll?n.querySelectorAll('p').length:0);var brCount=((n.innerHTML||'').match(/<br\\s*\\/?\\s*>/gi)||[]).length;return t.length + pCount*180 + brCount*40;}" +
        "var root=document.body||document.documentElement;if(!root)return '';" +
        "var candidates=[];" +
        "var sel='article,main,section,div,[class*=chapter],[class*=reader],[class*=reading],[class*=content],[id*=chapter],[id*=content]';" +
        "var nodes=[];try{nodes=Array.prototype.slice.call(root.querySelectorAll(sel));}catch(e){nodes=[];}" +
        "if(nodes.length===0)nodes=[root];" +
        "for(var i=0;i<nodes.length;i++){var n=nodes[i];if(!n)continue;var tag=(n.tagName||'').toLowerCase();if(/script|style|noscript|svg|canvas|header|footer|nav|aside/.test(tag))continue;var sc=scoreNode(n);if(sc>0)candidates.push({n:n,s:sc});}" +
        "candidates.sort(function(a,b){return b.s-a.s;});" +
        "for(var j=0;j<candidates.length;j++){var node=candidates[j].n;var html=(node.innerHTML||'').trim();var text=(node.innerText||node.textContent||'').replace(/\\s+/g,' ').trim();if(text.length<160)continue;if(badText(text))continue;return html||text;}" +
        "var bodyText=(root.innerText||root.textContent||'').replace(/\\s+/g,' ').trim();if(bodyText.length>260 && !badText(bodyText)) return bodyText;" +
        "return '';" +
    "})()";

    for (var i = 0; i < fnNames.length; i++) {
        var fn = fnNames[i];
        try {
            if (typeof browser[fn] !== "function") continue;
            var out = browser[fn](script);
            if (out === undefined || out === null) continue;
            var raw = String(out || "").trim();
            if (!raw) continue;

            var cleaned = cleanHtml(raw);
            if (isReadableHtml(cleaned) && !isCipherLikeContent(cleaned)) {
                return cleaned;
            }

            var text = htmlToText(cleaned || raw).replace(/\s+/g, " ").trim();
            if (text.length > 220 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(text)) {
                return plainTextToHtml(text);
            }
        } catch (_) {
        }
    }

    return "";
}

function tryBrowserRenderedContent(url) {
    var browser = null;
    var htmlCandidates = [];
    var textCandidates = [];

    var runtime = bootstrapAuthFromBrowser(url);
    if (runtime && runtime.html) {
        var fromRuntimeHtml = extractChapterFromRawHtml(runtime.html);
        if (fromRuntimeHtml) return fromRuntimeHtml;
    }
    if (runtime && runtime.text) {
        var runtimeText = String(runtime.text || "").replace(/\s+/g, " ").trim();
        if (runtimeText.length > 240 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(runtimeText)) {
            return plainTextToHtml(runtimeText);
        }
    }

    try {
        browser = Engine.newBrowser();
        browser.launch(url, 12000);

        var domSelected = extractFromBrowserDomBySelectors(browser, url);
        if (domSelected) {
            try { browser.close(); } catch (_) {}
            return domSelected;
        }

        var heuristicDom = extractFromBrowserDomHeuristic(browser);
        if (heuristicDom) {
            try { browser.close(); } catch (_) {}
            return heuristicDom;
        }

        try { htmlCandidates.push(String(browser.html() || "")); } catch (_) {}
        try { htmlCandidates.push(String(browser.getHtml() || "")); } catch (_) {}
        try { htmlCandidates.push(String(browser.pageSource() || "")); } catch (_) {}
        try { htmlCandidates.push(String(browser.source() || "")); } catch (_) {}

        try { textCandidates.push(String(browser.text() || "")); } catch (_) {}
        try { textCandidates.push(String(browser.getText() || "")); } catch (_) {}
        try { textCandidates.push(String(browser.bodyText() || "")); } catch (_) {}
    } catch (_) {
    }

    try {
        if (browser) browser.close();
    } catch (_) {
    }

    for (var i = 0; i < htmlCandidates.length; i++) {
        var html = extractChapterFromRawHtml(htmlCandidates[i]);
        if (html) return html;
    }

    for (var j = 0; j < textCandidates.length; j++) {
        var text = String(textCandidates[j] || "").replace(/\s+/g, " ").trim();
        if (text.length > 300 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(text)) {
            return plainTextToHtml(text);
        }
    }

    return "";
}

function loginRequiredError(url) {
    markAuthRetryNeeded();
    return Response.error(ERROR_MESSAGE + "\n" + (url || BASE_SOURCE));
}

function execute(url) {
    try {
        var retryMode = isAuthRetryNeeded();
        var runtimeCookie = getSessionCookie(url);
        var runtimeToken = "";
        try {
            runtimeToken = extractTokenFromCookie(runtimeCookie) ||
                localStorage.getItem("trangtruyen_token") ||
                localStorage.getItem("accessToken") ||
                localStorage.getItem("token") ||
                "";
        } catch (_) {
            runtimeToken = extractTokenFromCookie(runtimeCookie) || "";
        }

        if (retryMode) {
            var refreshed = forceRefreshSession(url);
            if (refreshed.cookie) runtimeCookie = refreshed.cookie;
            if (refreshed.token) runtimeToken = refreshed.token;
        }

        if (!runtimeToken || !runtimeCookie) {
            var browserBoot = bootstrapAuthFromBrowser(url);
            if (browserBoot.cookie) runtimeCookie = browserBoot.cookie;
            if (browserBoot.token) runtimeToken = browserBoot.token;

            try {
                if (runtimeToken) localStorage.setItem("trangtruyen_token", runtimeToken);
            } catch (_) {
            }

            if (browserBoot.html) {
                var bootHtml = extractChapterFromRawHtml(browserBoot.html);
                if (bootHtml && isReadableHtml(bootHtml) && !isCipherLikeContent(bootHtml)) {
                    clearAuthRetryNeeded();
                    return Response.success(bootHtml);
                }
            }

            if (browserBoot.text) {
                var bootText = String(browserBoot.text || "").replace(/\s+/g, " ").trim();
                if (bootText.length > 240 && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(bootText)) {
                    clearAuthRetryNeeded();
                    return Response.success(plainTextToHtml(bootText));
                }
            }
        }

        var pageResponse = fetch(url, {
            headers: buildTrangTruyenHeaders(buildApiAuthHeaders(runtimeToken, runtimeCookie))
        });

        var apiRes = tryApiContent(url, runtimeCookie, runtimeToken);
        var apiHtml = apiRes && apiRes.content ? apiRes.content : "";
        var chapterId = (apiRes && apiRes.chapterId) ? apiRes.chapterId : extractChapterId(url);
        var apiMeta = apiRes ? apiRes.contentMetaV2 : null;

        if (apiHtml && isCipherLikeContent(apiHtml) && apiMeta) {
            try {
                var decrypted = tryDecryptCipherContent(chapterId, apiHtml, apiMeta, runtimeCookie, runtimeToken);
                if (decrypted && decrypted.length > 30) {
                    clearAuthRetryNeeded();
                    return Response.success(decrypted);
                }
            } catch (_) {
            }
        }

        if (apiHtml && isReadableHtml(apiHtml) && !isCipherLikeContent(apiHtml)) {
            clearAuthRetryNeeded();
            return Response.success(apiHtml);
        }

        if ((apiRes && apiRes.requireLogin) && (runtimeToken || hasAnyAuthCredential())) {
            var domBySession = tryBrowserRenderedContent(url);
            if (domBySession && domBySession.length > 30) {
                clearAuthRetryNeeded();
                return Response.success(domBySession);
            }
        }

        if (!pageResponse.ok) {
            if (apiRes && apiRes.requireLogin) {
                return loginRequiredError(url);
            }
            return loginRequiredError(url);
        }

        var doc = pageResponse.html("utf-8");

        var scriptExtract = extractCipherMetaFromPage(doc, chapterId);
        if (scriptExtract && scriptExtract.cipherText && scriptExtract.contentMetaV2) {
            try {
                var decFromPage = tryDecryptCipherContent(
                    scriptExtract.chapterId || chapterId,
                    scriptExtract.cipherText,
                    scriptExtract.contentMetaV2,
                    runtimeCookie,
                    runtimeToken
                );
                if (decFromPage && decFromPage.length > 30) {
                    clearAuthRetryNeeded();
                    return Response.success(decFromPage);
                }
            } catch (_) {
            }
        }

        var html = extractHtmlContent(doc);

        if (isReadableHtml(html) && !isCipherLikeContent(html)) {
            clearAuthRetryNeeded();
            return Response.success(html);
        }

        var textOnly = (doc.text() || "").replace(/\s+/g, " ").trim();
        if (textOnly && textOnly.length > 60 && !isCipherLikeContent(textOnly) && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(textOnly)) {
            clearAuthRetryNeeded();
            return Response.success(plainTextToHtml(textOnly));
        }

        var text = doc.text() || "";
        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(text) || (apiRes && apiRes.requireLogin)) {
            if (retryMode) {
                var browserHtml = tryBrowserRenderedContent(url);
                if (browserHtml && browserHtml.length > 30) {
                    clearAuthRetryNeeded();
                    return Response.success(browserHtml);
                }
            }
            return loginRequiredError(url);
        }

        if ((apiHtml && isCipherLikeContent(apiHtml)) || isCipherLikeContent(html)) {
            if (retryMode) {
                var browserCipherFallback = tryBrowserRenderedContent(url);
                if (browserCipherFallback && browserCipherFallback.length > 30) {
                    clearAuthRetryNeeded();
                    return Response.success(browserCipherFallback);
                }
            }
            return loginRequiredError(url);
        }

        if (retryMode) {
            var browserFinalFallback = tryBrowserRenderedContent(url);
            if (browserFinalFallback && browserFinalFallback.length > 30) {
                clearAuthRetryNeeded();
                return Response.success(browserFinalFallback);
            }
        }

        return loginRequiredError(url);
    } catch (e) {
        return Response.error(ERROR_MESSAGE + "\n" + (url || BASE_SOURCE));
    }
}
