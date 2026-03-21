// ============================================================
// TrangTruyen - chap.js (v3)
// trangtruyen.site - Nội dung chương
// ============================================================

var BASE_URL = "https://trangtruyen.site";
var ERROR_LOGIN = "Vui lòng vào trang nguồn " + BASE_URL + ", đăng nhập, rồi quay lại nhấn Tải lại.";

// ---- Các chuỗi UI của trang cần loại bỏ ----
var UI_NOISE_PATTERNS = [
    /^Trang Truy[eệ]n/i,
    /^Đọc nhanh/i,
    /^Trang chủ/i,
    /^Thể loại/i,
    /^Mục lục/i,
    /^Cài đặt/i,
    /^Nghe audio/i,
    /^0\.5x|0\.75x|1\.25x|1\.5x|2x|2\.5x|3x/,
    /^►|▶|⏸|⏹/,
    /^Chương trước|^Chương sau|^Trang trước|^Trang sau/i,
    /^Trước$|^Sau$/i,
    /^Bình luận/i,
    /^Chia sẻ/i,
    /^Báo lỗi/i,
    /^Đánh dấu/i,
    /^Đọc ngay/i,
    /^← |^→ /,
    /Đọc (nhanh|truyện)/i,
    /tập trung vào nội dung/i,
    /^[\d./]+x[\d./]*x/  // speed controls like 0.5x0.75x1x...
];

// ---- Utility ----

function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^/?#]+)/i);
    return m ? m[1] : "";
}

// Xoá zero-width characters (watermark) và escape HTML entities
function stripZeroWidth(s) {
    return String(s || "")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF\u00AD\u034F]/g, "")
        .replace(/\u00a0/g, " ");
}

function isUILine(line) {
    if (!line || line.length < 2) return true;
    var trimmed = line.trim();
    for (var i = 0; i < UI_NOISE_PATTERNS.length; i++) {
        if (UI_NOISE_PATTERNS[i].test(trimmed)) return true;
    }
    // Các dòng quá ngắn (dưới 3 ký tự) không phải nội dung
    if (trimmed.length < 3) return true;
    return false;
}

function isLoginRequired(text) {
    return /đăng nhập|yêu cầu đăng|cần đăng nhập|login required|sign in/i.test(text || "");
}

function isGoodContent(text) {
    var t = stripZeroWidth(text || "").trim();
    if (t.length < 80) return false;
    if (isLoginRequired(t)) return false;
    return true;
}

// ---- Build HTML từ mảng paragraphs ----
// Mỗi paragraph là một thẻ <p> riêng biệt

function paragraphsToHtml(paragraphs) {
    if (!paragraphs || !paragraphs.length) return "";
    var out = [];
    for (var i = 0; i < paragraphs.length; i++) {
        var raw = String(paragraphs[i] || "");
        var p = stripZeroWidth(raw).trim();
        if (!p) continue;
        if (isUILine(p)) continue;
        // Escape các ký tự HTML đặc biệt trong nội dung text
        p = p.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;");
        out.push("<p>" + p + "</p>");
    }
    return out.join("\n");
}

// Convert plain text (có \n) thành HTML paragraphs
function textToHtml(text) {
    if (!text) return "";
    var cleaned = stripZeroWidth(text).trim();
    if (!cleaned) return "";
    var lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n+/);
    return paragraphsToHtml(lines);
}

// Chuyển HTML thành text (dùng để check)
function htmlToPlainText(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
}

// ---- Lấy Cookie ----

function getSiteCookie(url) {
    try {
        var c = localCookie.getCookie();
        if (c && c.length > 5) return String(c);
    } catch (_) {}

    try {
        var res = fetch(url || BASE_URL, {
            headers: { "User-Agent": UserAgent.chrome(), "Referer": BASE_URL + "/" }
        });
        if (res && res.request && res.request.headers) {
            var h = res.request.headers;
            var ck = h.cookie || h.Cookie || "";
            if (ck && ck.length > 5) return String(ck);
        }
    } catch (_) {}

    return "";
}

// ---- Java Crypto ----

function canUseJavaCrypto() {
    try { Java.type("javax.crypto.Cipher"); Java.type("java.util.Base64"); return true; }
    catch (_) { return false; }
}

function sha256Hex(input) {
    try {
        var MD = Java.type("java.security.MessageDigest");
        var CS = Java.type("java.nio.charset.StandardCharsets");
        var bytes = MD.getInstance("SHA-256").digest(new java.lang.String(String(input)).getBytes(CS.UTF_8));
        var sb = new java.lang.StringBuilder();
        for (var i = 0; i < bytes.length; i++) {
            var b = bytes[i]; if (b < 0) b += 256;
            var h = java.lang.Integer.toHexString(b);
            if (h.length() === 1) sb.append("0");
            sb.append(h);
        }
        return String(sb.toString());
    } catch (_) { return "a".repeat(64); }
}

function hexToBytes(hex) {
    var clean = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (clean.length % 2) clean = "0" + clean;
    var out = Java.type("byte[]")(clean.length / 2);
    for (var i = 0; i < out.length; i++)
        out[i] = java.lang.Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    return out;
}

function b64ToBytes(s) {
    return Java.type("java.util.Base64").getDecoder().decode(String(s || "").replace(/\s/g, ""));
}

function bytesToHex(bytes) {
    var sb = new java.lang.StringBuilder();
    for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i]; if (b < 0) b += 256;
        var h = java.lang.Integer.toHexString(b);
        if (h.length() === 1) sb.append("0");
        sb.append(h);
    }
    return String(sb.toString());
}

function aesGcmDecrypt(cipherBytes, ivBytes, keyHex) {
    var Cipher = Java.type("javax.crypto.Cipher");
    var SKS = Java.type("javax.crypto.spec.SecretKeySpec");
    var GCM = Java.type("javax.crypto.spec.GCMParameterSpec");
    var CS = Java.type("java.nio.charset.StandardCharsets");
    var key = hexToBytes(keyHex);
    var c = Cipher.getInstance("AES/GCM/NoPadding");
    c.init(Cipher.DECRYPT_MODE, new SKS(key, "AES"), new GCM(128, ivBytes));
    return String(new java.lang.String(c.doFinal(cipherBytes), CS.UTF_8));
}

// ---- Giải mã nội dung v3 ----
// chapter.content = JSON: {"v":3,"l2":"<b64>","m":"..."}
// Decode l2 → IV(12 bytes) + ciphertext, key=grantSecret (hex 64)
// → decrypt → {"d":"<b64>","i":"<b64>","g":"<hex>"} (stage1)
// Stage2: AES-GCM(d, iv=decode(i), key=g) → {"paragraphs":["..."]}

function decryptChapterContent(contentStr, grantSecretHex) {
    if (!contentStr || !grantSecretHex || !canUseJavaCrypto()) return null;
    try {
        var enc = safeJsonParse(contentStr);
        if (!enc || !enc.l2) return null;

        var raw = b64ToBytes(enc.l2);
        if (!raw || raw.length < 28) return null;

        var iv1 = Java.type("byte[]")(12);
        var ct1 = Java.type("byte[]")(raw.length - 12);
        java.lang.System.arraycopy(raw, 0, iv1, 0, 12);
        java.lang.System.arraycopy(raw, 12, ct1, 0, raw.length - 12);

        var stage1Text = aesGcmDecrypt(ct1, iv1, grantSecretHex);
        if (!stage1Text) return null;

        var s1 = safeJsonParse(stage1Text);
        if (s1 && s1.d && s1.i) {
            // Stage 2
            var ct2 = b64ToBytes(s1.d);
            var iv2 = b64ToBytes(s1.i);

            var keyHex2 = String(s1.g || "");
            // Nếu g là base64, chuyển sang hex
            if (!/^[0-9a-f]{32,}$/i.test(keyHex2)) {
                try { keyHex2 = bytesToHex(b64ToBytes(keyHex2)); } catch (_) {}
            }

            var stage2Text = aesGcmDecrypt(ct2, iv2, keyHex2);
            var parsed = safeJsonParse(stage2Text);
            if (parsed) return parsed;
            if (stage2Text && stage2Text.length > 80) return stage2Text;
        }

        if (s1) return s1;
        if (stage1Text && stage1Text.length > 80) return stage1Text;
    } catch (_) {}
    return null;
}

// ---- Chuyển kết quả decrypt thành HTML ----

function decryptResultToHtml(result) {
    if (!result) return "";

    // Dạng object
    if (typeof result === "object") {
        var paras = result.paragraphs || result.p || result.lines || result.content || null;
        if (Array.isArray(paras) && paras.length) {
            return paragraphsToHtml(paras);
        }
        if (typeof paras === "string" && paras.length > 50) {
            return textToHtml(paras);
        }
        // Thử stringify toàn bộ keys
        for (var k in result) {
            if (!result.hasOwnProperty(k)) continue;
            var v = result[k];
            if (Array.isArray(v) && v.length > 2) {
                var html = paragraphsToHtml(v);
                if (html.length > 100) return html;
            }
        }
    }

    // Dạng string (plain text)
    if (typeof result === "string" && result.length > 80) {
        return textToHtml(result);
    }

    return "";
}

// ---- Gọi API /chapters/{id} ----

function fetchChapterApi(chapterId, cookie) {
    var headers = {
        "User-Agent": UserAgent.chrome(),
        "Referer": BASE_URL + "/",
        "Accept": "application/json"
    };
    if (cookie) headers["Cookie"] = cookie;

    var res = fetch(BASE_URL + "/api/chapters/" + chapterId, { headers: headers });
    if (!res || !res.ok) return null;
    return res.json();
}

// ---- Gọi API /resolve để lấy grantSecret ----

function callResolveApi(chapterId, grantId, cookie) {
    if (!grantId || !cookie) return "";
    var ua = UserAgent.chrome();
    var uaHash = sha256Hex(ua);
    var deviceProof = sha256Hex(ua + "|vi-VN|UTC").substring(0, 32);

    var body = JSON.stringify({ grantId: grantId, deviceProof: deviceProof, uaHash: uaHash });

    // Thử 1: POST đầy đủ headers
    try {
        var res = fetch(BASE_URL + "/api/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: {
                "User-Agent": ua, "Content-Type": "application/json",
                "Accept": "application/json", "Referer": BASE_URL + "/",
                "Origin": BASE_URL, "x-client-ua-hash": uaHash,
                "x-device-proof": deviceProof, "Cookie": cookie
            },
            body: body
        });
        if (res && res.ok) {
            var j = res.json();
            if (j && j.grantSecret) return String(j.grantSecret);
        }
    } catch (_) {}

    // Thử 2: POST đơn giản chỉ với cookie và grantId
    try {
        var res2 = fetch(BASE_URL + "/api/chapters/" + chapterId + "/resolve", {
            method: "POST",
            headers: {
                "User-Agent": ua, "Content-Type": "application/json",
                "Referer": BASE_URL + "/", "Cookie": cookie
            },
            body: JSON.stringify({ grantId: grantId })
        });
        if (res2 && res2.ok) {
            var j2 = res2.json();
            if (j2 && j2.grantSecret) return String(j2.grantSecret);
        }
    } catch (_) {}

    return "";
}

// ---- Browser render ----
// Dùng callJs để đợi Web Worker giải mã bất đồng bộ xong

function tryBrowserRender(url) {
    var browser = null;
    try {
        browser = Engine.newBrowser();
        browser.launch(url, 15000);

        // Script lấy các <p> trong vùng nội dung, bỏ qua UI noise
        var extractScript = "(function(){\n" +
            "  var noiseRe = /Trang Truy|Nghe audio|M\u1ee5c l\u1ee5c|C\u00e0i \u0111\u1eb7t|\u0110\u1ecdc nhanh|\u00b00\\.\\d+x|Ch\u01b0\u01a1ng tr\u01b0\u1edbc|Ch\u01b0\u01a1ng sau/i;\n" +
            "  var contentSels = [\n" +
            "    '.chapter-content', '#chapter-content', '.reader-content',\n" +
            "    '.chapter-body', '.chapter-text', '.story-content',\n" +
            "    '[class*=\"chapter\"][class*=\"content\"]', '[class*=\"reader\"][class*=\"content\"]'\n" +
            "  ];\n" +
            "  \n" +
            "  // T\u00ecm container n\u1ed9i dung\n" +
            "  var container = null;\n" +
            "  for (var si = 0; si < contentSels.length; si++) {\n" +
            "    var el = document.querySelector(contentSels[si]);\n" +
            "    if (!el) continue;\n" +
            "    var t = (el.innerText||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').trim();\n" +
            "    if (t.length > 200 && !noiseRe.test(t.substring(0, 50))) { container = el; break; }\n" +
            "  }\n" +
            "  \n" +
            "  if (!container) {\n" +
            "    // Fallback: t\u00ecm div c\u00f3 nhi\u1ec1u <p> nh\u1ea5t\n" +
            "    var best = null, bestScore = 0;\n" +
            "    var divs = document.querySelectorAll('div, article, section');\n" +
            "    for (var i = 0; i < divs.length; i++) {\n" +
            "      var el2 = divs[i];\n" +
            "      var ps = el2.querySelectorAll('p');\n" +
            "      var t2 = (el2.innerText||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').trim();\n" +
            "      if (ps.length > 5 && t2.length > 300) {\n" +
            "        var firstLine = t2.substring(0, 60);\n" +
            "        if (!noiseRe.test(firstLine)) {\n" +
            "          var score = ps.length * 50 + t2.length;\n" +
            "          if (score > bestScore) { best = el2; bestScore = score; }\n" +
            "        }\n" +
            "      }\n" +
            "    }\n" +
            "    container = best;\n" +
            "  }\n" +
            "  \n" +
            "  if (!container) return '';\n" +
            "  \n" +
            "  // L\u1ea5y t\u00e2\u0301t c\u0103\u0309 <p> trong container, l\u1ecdc UI noise\n" +
            "  var ps2 = container.querySelectorAll('p');\n" +
            "  var result = [];\n" +
            "  for (var j = 0; j < ps2.length; j++) {\n" +
            "    var txt = (ps2[j].innerText||ps2[j].textContent||'')\n" +
            "              .replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'')\n" +
            "              .replace(/\\s+/g, ' ').trim();\n" +
            "    if (!txt || txt.length < 4) continue;\n" +
            "    if (noiseRe.test(txt)) continue;\n" +
            "    result.push(txt);\n" +
            "  }\n" +
            "  \n" +
            "  // N\u1ebfu \u00edt <p>, th\u1eed l\u1ea5y to\u00e0n b\u1ed9 text c\u1ee7a container\n" +
            "  if (result.length < 3) {\n" +
            "    var raw = (container.innerText||'').replace(/[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]/g,'').trim();\n" +
            "    return raw.length > 200 ? raw : '';\n" +
            "  }\n" +
            "  \n" +
            "  return JSON.stringify(result);\n" +
            "})()";

        var result = "";

        // Gọi callJs để chờ Web Worker giải mã xong
        try {
            var docAfter = browser.callJs(extractScript, 6000);
            if (docAfter) {
                try {
                    var txt = String(docAfter.text ? docAfter.text() : "").trim();
                    if (txt && txt.length > 50) result = txt;
                } catch (_) {}
            }
        } catch (_) {}

        // Nếu callJs không có kết quả, thử html()
        if (!result) {
            try {
                var fnNames = ["evaluate", "executeScript", "runScript", "eval"];
                for (var fi = 0; fi < fnNames.length && !result; fi++) {
                    try {
                        if (typeof browser[fnNames[fi]] === "function") {
                            var out = browser[fnNames[fi]](extractScript);
                            if (out && String(out).length > 50) result = String(out);
                        }
                    } catch (_) {}
                }
            } catch (_) {}
        }

        try { browser.close(); } catch (_) {}

        if (!result) return "";

        // Parse result (có thể là JSON array hoặc plain text)
        var arr = safeJsonParse(result);
        if (Array.isArray(arr) && arr.length > 0) {
            var html = paragraphsToHtml(arr);
            if (html.length > 100) return html;
        }

        // Plain text
        var stripped = stripZeroWidth(result).replace(/\s+/g, " ").trim();
        if (stripped.length > 100 && !isLoginRequired(stripped)) {
            return textToHtml(stripped);
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
        log("id=" + chapterId.substring(0, 10));

        // B1: Cookie
        var cookie = getSiteCookie(url);
        log("ck=" + (cookie ? cookie.length : 0));

        // B2: API
        var apiJson = fetchChapterApi(chapterId, cookie);
        log("api=" + (apiJson ? "ok" : "fail"));

        if (apiJson && apiJson.chapter) {
            var chapter = apiJson.chapter;
            var contentStr = String(chapter.content || "");
            var meta = apiJson.contentMetaV2 || chapter.contentMetaV2 || null;
            var grantId = meta ? (meta.grantId || meta.grantID || meta.id || "") : "";
            log("gid=" + (grantId ? "yes" : "no"));
            log("clen=" + contentStr.length);

            // Nội dung không bị mã hóa (chương miễn phí)
            var parsedContent = safeJsonParse(contentStr);
            if (!parsedContent && contentStr.length > 100) {
                var freeText = stripZeroWidth(contentStr).trim();
                if (isGoodContent(freeText)) {
                    return Response.success(textToHtml(freeText));
                }
            }

            log("v3=" + (parsedContent && parsedContent.v === 3 ? "yes" : "no"));
            log("java=" + (canUseJavaCrypto() ? "yes" : "no"));

            // B3: Resolve để lấy key giải mã
            if (grantId) {
                var grantSecret = callResolveApi(chapterId, grantId, cookie);
                log("secret=" + (grantSecret ? "yes_" + grantSecret.length : "no"));

                // B4: Giải mã AES-GCM (nếu Java crypto khả dụng)
                if (grantSecret && canUseJavaCrypto()) {
                    var decResult = decryptChapterContent(contentStr, grantSecret);
                    log("dec=" + (decResult ? "ok" : "fail"));
                    if (decResult) {
                        var html = decryptResultToHtml(decResult);
                        log("htmlLen=" + html.length);
                        if (html.length > 80) {
                            return Response.success(html);
                        }
                    }
                }

                // B5: Không có Java crypto HOẶC decrypt thất bại → Browser render
                log("browser_start");
                var browserHtml = tryBrowserRender(url);
                log("browserLen=" + (browserHtml || "").length);
                if (browserHtml && browserHtml.length > 80) {
                    return Response.success(browserHtml);
                }

                if (!grantSecret) {
                    return Response.error(ERROR_LOGIN + "\n[" + dbg.join("|") + "]");
                }
            }
        }

        // B6: Fallback browser render
        log("fallback");
        var fallback = tryBrowserRender(url);
        log("fbLen=" + (fallback || "").length);
        if (fallback && fallback.length > 80) {
            return Response.success(fallback);
        }

        // B7: Fetch HTML trực tiếp (chương miễn phí không cần JS)
        try {
            var pRes = fetch(url, {
                headers: { "User-Agent": UserAgent.chrome(), "Referer": BASE_URL + "/", "Cookie": cookie || "" }
            });
            if (pRes && pRes.ok) {
                var doc = pRes.html("utf-8");
                var sels = [".chapter-content", "#chapter-content", ".reader-content", ".chapter-body"];
                for (var si = 0; si < sels.length; si++) {
                    var node = doc.select(sels[si]).first();
                    if (!node) continue;

                    // Lấy tất cả <p> trong node, bỏ UI noise
                    var pNodes = node.select("p");
                    if (pNodes && pNodes.size() > 0) {
                        var paras = [];
                        for (var pi = 0; pi < pNodes.size(); pi++) {
                            var pText = stripZeroWidth(pNodes.get(pi).text() || "").trim();
                            if (pText.length > 3 && !isUILine(pText)) {
                                paras.push(pText);
                            }
                        }
                        if (paras.length > 2) {
                            var pHtml = paragraphsToHtml(paras);
                            if (pHtml.length > 100) return Response.success(pHtml);
                        }
                    }

                    // Fallback: toàn bộ text của node
                    var nodeText = stripZeroWidth(node.text() || "").replace(/\s+/g, " ").trim();
                    if (isGoodContent(nodeText)) {
                        return Response.success(textToHtml(nodeText));
                    }
                }
            }
        } catch (_) {}

        return Response.error(ERROR_LOGIN + "\n[" + dbg.join("|") + "]");
    } catch (e) {
        return Response.error(ERROR_LOGIN + "\n[ERR:" + String((e && e.message) || e) + "]");
    }
}
