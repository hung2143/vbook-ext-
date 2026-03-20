function cleanHtml(html) {
    if (!html) return "";
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<form[\s\S]*?<\/form>/gi, "");
    html = html.replace(/<div[^>]*class=["'][^"']*(comment|login|ads?|related)[^"']*["'][\s\S]*?<\/div>/gi, "");
    return html;
}

function cleanText(s) {
    if (!s) return "";
    return String(s)
        .replace(/\uFEFF/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00A0/g, " ")
        .trim();
}

function splitParagraphs(text) {
    text = cleanText(text);
    if (!text) return [];
    var arr = text.split(/\n{2,}/g);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        var p = (arr[i] || "").trim();
        if (p) out.push(p);
    }
    return out;
}

function canUseJavaCrypto() {
    try {
        Java.type("java.security.MessageDigest");
        Java.type("javax.crypto.Cipher");
        return true;
    } catch (_) {
        return false;
    }
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

function isCipherLikeContent(html) {
    var s = (html || "").replace(/\s+/g, " ").trim();
    if (!s || s.length < 40) return false;

    if (/^\{\s*"v"\s*:\s*\d+/i.test(s) && /"l2"\s*:/i.test(s)) return true;
    if (/^\{\s*"v"\s*:\s*\d+/i.test(s) && /[A-Za-z0-9+/=]{80,}/.test(s)) return true;

    var looksLikeHtml = /<p[\s>]|<div[\s>]|<br\s*\/?\s*>|<article[\s>]|<section[\s>]/i.test(s);
    if (looksLikeHtml) return false;

    var alphaNum = (s.match(/[A-Za-z0-9]/g) || []).length;
    var punct = (s.match(/[{}\[\]"'\/:+=]/g) || []).length;
    if (alphaNum > 150 && punct > 30 && punct / Math.max(1, s.length) > 0.08) return true;

    return false;
}

function extractChapterId(url) {
    var m = (url || "").match(/\/read\/([^\/?#]+)/i);
    return m ? m[1] : "";
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

function decodeBase64Utf8(s) {
    var StandardCharsets = Java.type("java.nio.charset.StandardCharsets");
    return String(new java.lang.String(decodeBase64Bytes(s), StandardCharsets.UTF_8));
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

function buildDeviceProof() {
    var ua = UserAgent.chrome() || "";
    var proofSeed = [ua, "vi-VN", "0", "0", "UTC"].join("|");
    return "fallback-" + sha256Hex(proofSeed).substring(0, 32);
}

function buildUaHash() {
    return sha256Hex(UserAgent.chrome() || "");
}

function isBase64Like(s) {
    if (!s) return false;
    var v = String(s).replace(/\s+/g, "");
    if (v.length < 8) return false;
    return /^[A-Za-z0-9+/=]+$/.test(v);
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

function deriveKeyHexes(resolveObj, metaObj) {
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
                }
            }
        }
    }
    return out;
}

function normalizeParagraphs(payload) {
    if (!payload) return [];
    if (payload.paragraphs && payload.paragraphs.length) return payload.paragraphs;
    if (payload.p && payload.p.length) return payload.p;
    if (payload.lines && payload.lines.length) return payload.lines;
    if (payload.content && typeof payload.content === "string") return splitParagraphs(payload.content);

    var f = payload.f || [];
    var o = payload.o || [];
    if (o && o.length) {
        var out = [];
        for (var i = 0; i < o.length; i++) {
            var s = String(o[i] || "").trim();
            if (s) out.push(s);
        }
        if (out.length) return out;
    }

    if (typeof payload === "string") return splitParagraphs(payload);
    return [];
}

function tryDecryptCipherContent(chapterId, encryptedJson, contentMeta) {
    if (!canUseJavaCrypto()) return "";
    if (!chapterId || !encryptedJson || !contentMeta) return "";

    var enc;
    try {
        enc = JSON.parse(encryptedJson);
    } catch (_) {
        return "";
    }
    if (!enc || !enc.l2) return "";

    var grantId = pickFirstValue(contentMeta, ["grantId", "grantID", "id", "g", "gid"]);
    if (!grantId) return "";

    var deviceProof = buildDeviceProof();
    var uaHash = buildUaHash();

    var resolveRes = fetch("https://trangtruyen.site/api/chapters/" + chapterId + "/resolve", {
        method: "POST",
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/",
            "content-type": "application/json",
            "x-device-proof": deviceProof,
            "x-client-ua-hash": uaHash
        },
        body: JSON.stringify({
            grantId: grantId,
            deviceProof: deviceProof,
            uaHash: uaHash
        })
    });
    if (!resolveRes.ok) return "";

    var resolveObj;
    try {
        resolveObj = resolveRes.json();
    } catch (_) {
        return "";
    }
    if (!resolveObj) return "";

    var base64Fields = [];
    for (var k in enc) {
        if (!enc.hasOwnProperty(k)) continue;
        if (k === "l2") continue;
        var v = enc[k];
        if (typeof v === "string" && isBase64Like(v)) base64Fields.push({ key: k, val: v });
    }
    if (!base64Fields.length) return "";

    var keyCandidates1 = deriveKeyHexes(resolveObj, contentMeta);
    var firstStage = null;

    for (var i = 0; i < keyCandidates1.length && !firstStage; i++) {
        for (var a = 0; a < base64Fields.length && !firstStage; a++) {
            for (var b = 0; b < base64Fields.length && !firstStage; b++) {
                if (a === b) continue;
                try {
                    var txt = aesGcmDecryptBase64Parts(enc.l2, base64Fields[a].val, base64Fields[b].val, keyCandidates1[i]);
                    var obj = JSON.parse(txt);
                    if (obj && obj.d && obj.i && obj.g) {
                        firstStage = obj;
                    }
                } catch (_) {
                }
            }
        }
    }
    if (!firstStage) return "";

    var keyCandidates2 = deriveKeyHexes(resolveObj, contentMeta);
    var secondStage = null;
    for (var j = 0; j < keyCandidates2.length && !secondStage; j++) {
        try {
            var txt2 = aesGcmDecryptBase64Parts(firstStage.d, firstStage.i, firstStage.g, keyCandidates2[j]);
            var obj2 = JSON.parse(txt2);
            var paras = normalizeParagraphs(obj2);
            if (paras && paras.length) {
                secondStage = paras;
            }
        } catch (_) {
        }
    }

    return paragraphsToHtml(secondStage || []);
}

function tryApiContent(url) {
    var chapterId = extractChapterId(url);
    if (!chapterId) return "";

    var response = fetch("https://trangtruyen.site/api/chapters/" + chapterId, {
        headers: {
            "user-agent": UserAgent.chrome(),
            "referer": "https://trangtruyen.site/"
        }
    });
    if (!response.ok) return "";

    var json = response.json();
    if (!json || !json.chapter) {
        return { content: "", requireLogin: false, chapterId: chapterId, contentMetaV2: null };
    }

    var content = json.chapter.content || "";
    return {
        content: content ? cleanHtml(content) : "",
        requireLogin: !!json.requireLogin,
        chapterId: String((json.chapter && json.chapter.id) || chapterId || ""),
        contentMetaV2: (json.contentMetaV2 || null)
    };
}

function execute(url) {
    try {
        var apiRes = tryApiContent(url);
        var apiHtml = apiRes && apiRes.content ? apiRes.content : "";
        if (apiHtml && apiHtml.length > 80 && !isCipherLikeContent(apiHtml)) {
            return Response.success(apiHtml);
        }

        if (apiHtml && isCipherLikeContent(apiHtml) && apiRes && apiRes.contentMetaV2) {
            try {
                var decrypted = tryDecryptCipherContent(apiRes.chapterId, apiHtml, apiRes.contentMetaV2);
                if (decrypted && decrypted.length > 20) {
                    return Response.success(decrypted);
                }
            } catch (_) {
                // Keep falling through to HTML fallback instead of failing chapter load.
            }
        }

        var response = fetch(url, {
            headers: {
                "user-agent": UserAgent.chrome(),
                "referer": "https://trangtruyen.site/"
            }
        });
        if (!response.ok) return null;

        var doc = response.html("utf-8");
        var selectors = [
            ".chapter-content",
            "article",
            "main",
            ".content",
            "body"
        ];

        var html = "";
        for (var i = 0; i < selectors.length; i++) {
            var node = doc.select(selectors[i]).first();
            if (!node) continue;
            html = node.html() || "";
            if (html && html.length > 80) break;
        }

        if (!html) html = doc.html() || "";
        html = cleanHtml(html);

        if (isCipherLikeContent(html)) {
            return Response.success("<p>Nội dung chương đang được mã hóa. Nếu chưa đọc được, hãy đăng nhập lại trong app và thử tải lại chương.</p>");
        }

        var text = doc.text() || "";
        if (/Yêu\s*cầu\s*đăng\s*nhập|Bạn\s*cần\s*đăng\s*nhập/i.test(text) || (apiRes && apiRes.requireLogin && (!html || html.length < 80))) {
            return null;
        }

        return Response.success(html);
    } catch (e) {
        return null;
    }
}
