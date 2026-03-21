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

function buildTrangTruyenHeaders(extra) {
    var headers = {
        "User-Agent": UserAgent.chrome(),
        "Referer": "https://trangtruyen.site/"
    };

    try {
        var cookie = localCookie.getCookie();
        if (cookie) headers["Cookie"] = cookie;
    } catch (_) {
    }

    try {
        var token =
            localStorage.getItem("trangtruyen_token") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("token") ||
            "";
        if (token) headers["Authorization"] = /^Bearer\s+/i.test(token) ? token : ("Bearer " + token);
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

function tryDecryptCipherContent(chapterId, cipherText, contentMeta) {
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
            "origin": "https://trangtruyen.site"
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

function tryApiContent(url) {
    var chapterId = extractChapterId(url);
    if (!chapterId) return { content: "", requireLogin: false, chapterId: "", contentMetaV2: null };

    var response = fetch("https://trangtruyen.site/api/chapters/" + chapterId, {
        headers: buildTrangTruyenHeaders()
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

function execute(url) {
    try {
        var apiRes = tryApiContent(url);
        var apiHtml = apiRes && apiRes.content ? apiRes.content : "";
        var chapterId = (apiRes && apiRes.chapterId) ? apiRes.chapterId : extractChapterId(url);
        var apiMeta = apiRes ? apiRes.contentMetaV2 : null;

        if (apiHtml && isCipherLikeContent(apiHtml) && apiMeta) {
            try {
                var decrypted = tryDecryptCipherContent(chapterId, apiHtml, apiMeta);
                if (decrypted && decrypted.length > 30) {
                    return Response.success(decrypted);
                }
            } catch (_) {
            }
        }

        if (apiHtml && isReadableHtml(apiHtml) && !isCipherLikeContent(apiHtml)) {
            return Response.success(apiHtml);
        }

        var response = fetch(url, {
            headers: buildTrangTruyenHeaders()
        });

        if (!response.ok) {
            if (apiRes && apiRes.requireLogin) {
                return Response.success("<p>Nội dung chương yêu cầu đăng nhập. Hãy đăng nhập lại trong app rồi tải lại chương.</p>");
            }
            if (apiHtml && isCipherLikeContent(apiHtml)) {
                return Response.success("<p>Nội dung chương đang được mã hóa từ nguồn. Plugin hiện chưa giải mã tự động được chương này.</p>");
            }
            return Response.success("<p>Không tải được nội dung chương từ nguồn. Bạn có thể bấm 'Xem trang nguồn' rồi thử lại.</p>");
        }

        var doc = response.html("utf-8");

        var scriptExtract = extractCipherMetaFromPage(doc, chapterId);
        if (scriptExtract && scriptExtract.cipherText && scriptExtract.contentMetaV2) {
            try {
                var decFromPage = tryDecryptCipherContent(
                    scriptExtract.chapterId || chapterId,
                    scriptExtract.cipherText,
                    scriptExtract.contentMetaV2
                );
                if (decFromPage && decFromPage.length > 30) {
                    return Response.success(decFromPage);
                }
            } catch (_) {
            }
        }

        var html = extractHtmlContent(doc);

        if (isReadableHtml(html) && !isCipherLikeContent(html)) {
            return Response.success(html);
        }

        var textOnly = (doc.text() || "").replace(/\s+/g, " ").trim();
        if (textOnly && textOnly.length > 60 && !isCipherLikeContent(textOnly) && !/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập|Mã\s*chương\s*không\s*hợp\s*lệ/i.test(textOnly)) {
            return Response.success(plainTextToHtml(textOnly));
        }

        var text = doc.text() || "";
        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(text) || (apiRes && apiRes.requireLogin)) {
            if (hasAnyAuthCredential()) {
                return Response.success("<p>Đã có phiên đăng nhập nhưng nguồn vẫn trả trạng thái yêu cầu đăng nhập cho chương này. Hãy mở trang nguồn trong app rồi tải lại để làm mới phiên.</p>");
            }
            return Response.success("<p>Nội dung chương yêu cầu đăng nhập. Hãy đăng nhập lại trong app rồi tải lại chương.</p>");
        }

        if ((apiHtml && isCipherLikeContent(apiHtml)) || isCipherLikeContent(html)) {
            return Response.success("<p>Nội dung chương đang được mã hóa từ nguồn. Plugin hiện chưa giải mã tự động được chương này.</p>");
        }

        return Response.success("<p>Không tải được nội dung chương từ nguồn. Bạn có thể bấm 'Xem trang nguồn' rồi thử lại.</p>");
    } catch (e) {
        return Response.success("<p>Không tải được nội dung chương do lỗi tạm thời. Hãy thử tải lại hoặc mở trang nguồn.</p>");
    }
}
