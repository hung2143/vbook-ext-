// ============================================================
// TrangTruyen - chap.js (v2)
// Lấy nội dung chương từ trangtruyen.site
// ============================================================

var BASE_URL = "https://trangtruyen.site";
var ERROR_LOGIN = "Vui lòng vào trang nguồn " + BASE_URL + ", đăng nhập, rồi quay lại nhấn Tải lại.";

// ---- Utility functions ----

function cleanContent(html) {
    if (!html) return "";
    // Xoá zero-width characters (watermark của trang)
    html = html.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD]/g, "");
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    return html;
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
        var line = (lines[i] || "").trim();
        if (line) out.push("<p>" + line + "</p>");
    }
    return out.join("\n");
}

function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^/?#]+)/i);
    return m ? m[1] : "";
}

function isLoginRequired(text) {
    return /đăng nhập|yêu cầu đăng|cần đăng nhập|login required|sign in/i.test(text || "");
}

function isGoodContent(text) {
    if (!text || text.length < 80) return false;
    if (isLoginRequired(text)) return false;
    return true;
}

// ---- Lấy Cookie từ vBook ----
// vBook tự động gửi cookie của domain khi fetch request
// Lấy qua res.request.headers.cookie

function getSiteCookie(url) {
    // Cách 1: localCookie API
    try {
        var c = localCookie.getCookie();
        if (c && c.indexOf("trangtruyen") !== -1) return String(c);
        if (c && c.length > 10) return String(c);
    } catch (_) {}

    // Cách 2: Lấy từ request cookie khi fetch trang
    try {
        var probeUrl = url || (BASE_URL + "/");
        var res = fetch(probeUrl, {
            headers: {
                "User-Agent": UserAgent.chrome(),
                "Referer": BASE_URL + "/"
            }
        });
        if (res && res.request && res.request.headers) {
            var h = res.request.headers;
            var ck = h.cookie || h.Cookie || h["Cookie"] || "";
            if (ck && ck.length > 5) return String(ck);
        }
    } catch (_) {}

    return "";
}

// ---- Java Crypto (AES-GCM) ----

function canUseJavaCrypto() {
    try {
        Java.type("javax.crypto.Cipher");
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
        return "a".repeat(64);
    }
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

function b64ToBytes(s) {
    return Java.type("java.util.Base64").getDecoder().decode(String(s || "").replace(/\s/g, ""));
}

function aesGcmDecrypt(data, iv, keyHex) {
    // data: byte[], iv: byte[], keyHex: hex string
    var Cipher = Java.type("javax.crypto.Cipher");
    var SKS = Java.type("javax.crypto.spec.SecretKeySpec");
    var GCM = Java.type("javax.crypto.spec.GCMParameterSpec");
    var CS = Java.type("java.nio.charset.StandardCharsets");
    var key = hexToBytes(keyHex);
    var c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.DECRYPT_MODE, new SKS(key, "AES"), new GCM(128, iv));
    var plain = c.doFinal(data);
    return String(new java.lang.String(plain, CS.UTF_8));
}

// ---- Giải mã nội dung v3 ----
// chapter.content = JSON string: {"v":3,"l2":"<b64>","m":"..."}
// l2 = IV(12 bytes) + ciphertext + GCM tag (16 bytes), key = grantSecret (hex 64 chars)
// Sau khi decrypt l2 → JSON {"d":"<b64>","i":"<b64>","g":"<hex>"} (stage 1)
// Stage 2: AES-GCM decrypt d với iv=b64(i), key=hex(g)
// → {"paragraphs":["..."]} hoặc text

function decryptChapterContent(contentStr, grantSecretHex) {
    if (!contentStr || !grantSecretHex) return "";
    if (!canUseJavaCrypto()) return "";

    try {
        var enc = safeJsonParse(contentStr);
        if (!enc || !enc.l2) return "";

        // Decode l2
        var rawBytes = b64ToBytes(enc.l2);
        if (!rawBytes || rawBytes.length < 28) return "";  // 12 IV + at least 16 bytes

        // Extract IV (first 12 bytes) và ciphertext
        var iv1 = Java.type("byte[]")(12);
        var ct1 = Java.type("byte[]")(rawBytes.length - 12);
        java.lang.System.arraycopy(rawBytes, 0, iv1, 0, 12);
        java.lang.System.arraycopy(rawBytes, 12, ct1, 0, rawBytes.length - 12);

        // Giải mã stage 1
        var stage1Text = aesGcmDecrypt(ct1, iv1, grantSecretHex);
        if (!stage1Text) return "";

        // Parse stage 1
        var s1 = safeJsonParse(stage1Text);
        if (s1) {
            // Có stage 2: {"d":"<b64>","i":"<b64>","g":"<hex>"}
            if (s1.d && s1.i && s1.g) {
                try {
                    // Stage 2: decrypt d, iv=b64(i), key=hex(g) or raw bytes
                    var ct2 = b64ToBytes(s1.d);
                    var iv2 = b64ToBytes(s1.i);

                    // g có thể là hex string hoặc base64 key
                    var keyHex2 = String(s1.g || "");
                    if (!/^[0-9a-f]{32,64}$/i.test(keyHex2)) {
                        // Thử giải mã base64 → hex
                        try {
                            var gBytes = b64ToBytes(keyHex2);
                            var sb2 = new java.lang.StringBuilder();
                            for (var gi = 0; gi < gBytes.length; gi++) {
                                var gb = gBytes[gi]; if (gb < 0) gb += 256;
                                var gh = java.lang.Integer.toHexString(gb);
                                if (gh.length() === 1) sb2.append("0");
                                sb2.append(gh);
                            }
                            keyHex2 = String(sb2.toString());
                        } catch (_) {}
                    }

                    var stage2Text = aesGcmDecrypt(ct2, iv2, keyHex2);
                    if (stage2Text) {
                        return parseContentToHtml(stage2Text);
                    }
                } catch (_) {}
            }

            // Stage 1 chính là nội dung cuối
            return parseContentToHtml(stage1Text);
        }

        // stage1Text là plain text
        if (stage1Text.length > 80) {
            return plainTextToHtml(stage1Text);
        }
    } catch (_) {}

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
                var p = String(paragraphs[i] || "").replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "").trim();
                if (p) html.push("<p>" + p + "</p>");
            }
            return html.join("\n");
        }
        if (typeof obj.content === "string" && obj.content.length > 50) {
            return plainTextToHtml(obj.content);
        }
    }
    // Plain text
    var cleaned = String(text).replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "").trim();
    if (cleaned.length > 80) return plainTextToHtml(cleaned);
    return "";
}

// ---- Gọi API ----

function fetchChapterApi(chapterId, cookie) {
    var ua = UserAgent.chrome();
    var headers = {
        "User-Agent": ua,
        "Referer": BASE_URL + "/",
        "Accept": "application/json"
    };
    if (cookie) {
        headers["Cookie"] = cookie;
    }

    var res = fetch(BASE_URL + "/api/chapters/" + chapterId, { headers: headers });
    if (!res || !res.ok) return null;
    return res.json();
}

function callResolveApi(chapterId, grantId, cookie) {
    if (!grantId || !cookie) return "";
    var ua = UserAgent.chrome();
    var uaHash = sha256Hex(ua);
    var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);

    var headers = {
        "User-Agent": ua,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": BASE_URL + "/",
        "Origin": BASE_URL,
        "x-client-ua-hash": uaHash,
        "x-device-proof": deviceProof,
        "Cookie": cookie
    };

    var body = JSON.stringify({
        grantId: grantId,
        deviceProof: deviceProof,
        uaHash: uaHash
    });

    // Thử POST
    try {
        var res = fetch(BASE_URL + "/api/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: headers,
            body: body
        });
        if (res && res.ok) {
            var j = res.json();
            if (j && j.grantSecret) return String(j.grantSecret);
        }
    } catch (_) {}

    // Thử không gửi deviceProof/uaHash (đơn giản hơn)
    try {
        var headers2 = {
            "User-Agent": ua,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Referer": BASE_URL + "/",
            "Cookie": cookie
        };
        var res2 = fetch(BASE_URL + "/api/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: headers2,
            body: JSON.stringify({ grantId: grantId })
        });
        if (res2 && res2.ok) {
            var j2 = res2.json();
            if (j2 && j2.grantSecret) return String(j2.grantSecret);
        }
    } catch (_) {}

    return "";
}

// ---- Browser render với chờ đủ lâu ----
// Trang dùng Web Worker giải mã nội dung (async), phải đợi sau khi JS chạy xong

function tryBrowserRender(url, cookie) {
    var browser = null;
    try {
        browser = Engine.newBrowser();

        // Mở trang, chờ 15 giây để JS và Web Worker giải mã chạy xong
        browser.launch(url, 15000);

        // Script tìm nội dung chương trong DOM
        var contentScript = "(function(){" +
            "var sels=['.chapter-content','#chapter-content','.reader-content','.chapter-body'];" +
            "for(var i=0;i<sels.length;i++){" +
            "  var n=document.querySelector(sels[i]);if(!n)continue;" +
            "  var t=(n.innerText||n.textContent||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').replace(/\\s+/g,' ').trim();" +
            "  if(t.length>150&&!/\u0111\u0103ng nh\u1eadp|login|y\u00eau c\u1ea7u \u0111\u0103ng/i.test(t)){return n.innerHTML||t;}" +
            "}" +
            "return '';" +
            "})()";

        var result = "";

        // Thử callJs (đợi thêm 5 giây cho Web Worker)
        try {
            var docAfter = browser.callJs(contentScript, 5000);
            if (docAfter) {
                try {
                    var txt = String(docAfter.text ? docAfter.text() : "").replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim();
                    if (txt.length > 150 && !isLoginRequired(txt)) result = txt;
                } catch (_) {}
            }
        } catch (_) {}

        // Nếu callJs không có kết quả, thử lấy HTML sau đó
        if (!result) {
            try {
                var finalDoc = browser.html();
                if (finalDoc) {
                    var sels = [".chapter-content", "#chapter-content", ".reader-content", ".chapter-body"];
                    for (var i = 0; i < sels.length && !result; i++) {
                        try {
                            var node = finalDoc.select(sels[i]).first();
                            if (!node) continue;
                            var nodeText = String(node.text ? node.text() : "").replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim();
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

// ---- Main execute ----

function execute(url) {
    var dbg = [];
    function log(s) { try { dbg.push(String(s)); } catch (_) {} }

    try {
        var chapterId = extractChapterId(url);
        if (!chapterId) return Response.error("Không lấy được chapter ID.");

        log("chapId=" + chapterId.substring(0, 12));

        // Bước 1: Lấy cookie
        var cookie = getSiteCookie(url);
        log("cookie=" + (cookie ? "1" : "0"));
        log("cookieLen=" + (cookie || "").length);
        log("hasSid=" + (cookie && cookie.indexOf("trangtruyen") >= 0 ? "1" : "0"));

        // Bước 2: Gọi API chapter
        var apiJson = fetchChapterApi(chapterId, cookie);
        log("apiOk=" + (apiJson ? "1" : "0"));

        if (apiJson && apiJson.chapter) {
            var chapter = apiJson.chapter;
            var contentStr = String(chapter.content || "");
            log("contentLen=" + contentStr.length);
            log("contentIsJson=" + (safeJsonParse(contentStr) ? "1" : "0"));

            // Lấy contentMetaV2 (có thể ở cấp top-level hoặc trong chapter)
            var meta = apiJson.contentMetaV2 || chapter.contentMetaV2 || null;
            var grantId = "";
            if (meta) {
                grantId = meta.grantId || meta.grantID || meta.id || meta.g || "";
            }
            log("grantId=" + (grantId ? grantId.substring(0, 12) : "none"));

            // Kiểm tra nội dung không bị mã hóa (chương miễn phí)
            var parsedContent = safeJsonParse(contentStr);
            if (contentStr && !parsedContent) {
                // contentStr là HTML hoặc text thuần
                var cleaned0 = cleanContent(contentStr);
                var text0 = htmlToText(cleaned0);
                if (isGoodContent(text0)) {
                    if (/<p[\s>]|<br/.test(cleaned0)) return Response.success(cleaned0);
                    return Response.success(plainTextToHtml(text0));
                }
            }

            // Kiểm tra xem có phải cipher v3 không
            var isCipherV3 = parsedContent && parsedContent.v === 3 && parsedContent.l2;
            log("cipherV3=" + (isCipherV3 ? "1" : "0"));
            log("javaCrypto=" + (canUseJavaCrypto() ? "1" : "0"));

            // Bước 3: Gọi /resolve để lấy grantSecret
            if (grantId) {
                var grantSecret = callResolveApi(chapterId, grantId, cookie);
                log("grantSecret=" + (grantSecret ? "1" : "0") + "_len=" + (grantSecret || "").length);

                if (grantSecret && canUseJavaCrypto()) {
                    // Bước 4: Giải mã AES-GCM
                    var decrypted = decryptChapterContent(contentStr, grantSecret);
                    log("decryptLen=" + (decrypted || "").length);
                    if (decrypted && decrypted.length > 50) {
                        return Response.success(cleanContent(decrypted));
                    }
                }

                if (grantSecret && !canUseJavaCrypto()) {
                    // Có key nhưng không thể giải mã bằng Java → Dùng browser render
                    // (Browser sẽ dùng JS native để giải mã)
                    log("noJavaCrypto_tryBrowser=1");
                    var browserWithKey = tryBrowserRender(url, cookie);
                    log("browserWithKeyLen=" + (browserWithKey || "").length);
                    if (browserWithKey && browserWithKey.length > 50) {
                        return Response.success(browserWithKey);
                    }
                }

                if (!grantSecret) {
                    // Không lấy được key → chưa đăng nhập hoặc session hết hạn
                    // Thử browser render (nội dung sẽ được giải mã bởi JS trang web)
                    log("noGrantSecret_tryBrowser=1");
                    var browserHtml = tryBrowserRender(url, cookie);
                    log("browserHtmlLen=" + (browserHtml || "").length);
                    if (browserHtml && browserHtml.length > 50) {
                        return Response.success(browserHtml);
                    }
                    return Response.error(ERROR_LOGIN + "\n[DBG: " + dbg.join("|") + "]");
                }
            }

            // Không có grantId → thử browser render
            log("noGrantId_tryBrowser=1");
        }

        // Bước 5: Fallback browser render
        log("fallback_browser=1");
        var browserFallback = tryBrowserRender(url, cookie);
        log("browserFallbackLen=" + (browserFallback || "").length);
        if (browserFallback && browserFallback.length > 50) {
            return Response.success(browserFallback);
        }

        // Bước 6: Fetch HTML trực tiếp
        try {
            var pageHeaders = {
                "User-Agent": UserAgent.chrome(),
                "Referer": BASE_URL + "/"
            };
            if (cookie) pageHeaders["Cookie"] = cookie;

            var pageRes = fetch(url, { headers: pageHeaders });
            log("htmlPageOk=" + (pageRes && pageRes.ok ? "1" : "0"));
            if (pageRes && pageRes.ok) {
                var doc = pageRes.html("utf-8");
                var selList = [".chapter-content", "#chapter-content", ".reader-content", ".chapter-body", "article.chapter", "article", "main"];
                for (var si = 0; si < selList.length; si++) {
                    var node = doc.select(selList[si]).first();
                    if (!node) continue;
                    var nodeHtml = cleanContent(node.html() || "");
                    var nodeText = htmlToText(nodeHtml);
                    log("htmlSel=" + selList[si] + "_len=" + nodeText.length);
                    if (isGoodContent(nodeText)) {
                        return Response.success(nodeHtml);
                    }
                }
            }
        } catch (_) {}

        return Response.error(ERROR_LOGIN + "\n[DBG: " + dbg.join(" | ") + "]");
    } catch (e) {
        return Response.error(ERROR_LOGIN + "\n[Exception: " + String((e && e.message) || e) + " | DBG: " + dbg.join("|") + "]");
    }
}

