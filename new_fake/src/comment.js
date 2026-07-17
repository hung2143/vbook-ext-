load("config.js");

function formatTime(timestamp) {
    if (!timestamp) return "";
    try {
        var date = new Date(timestamp * 1000);
        var year = date.getFullYear();
        var month = ("0" + (date.getMonth() + 1)).slice(-2);
        var day = ("0" + date.getDate()).slice(-2);
        var hours = ("0" + date.getHours()).slice(-2);
        var minutes = ("0" + date.getMinutes()).slice(-2);
        return year + "-" + month + "-" + day + " " + hours + ":" + minutes;
    } catch (e) {
        return "";
    }
}

function execute(input, page) {
    var bookId = String(input || "").trim();
    if (!bookId) {
        return Response.success([]);
    }

    var offset = parseInt(page || "0", 10);
    var count = 20;

    var response = fetchPage(getUrl("/api/comment"), {
        queries: {
            book_id: bookId,
            count: String(count),
            offset: String(offset)
        },
        timeout: 30000
    });

    if (!response || !response.ok) {
        return Response.success([]);
    }

    var obj = SafeJson(response);
    if (!obj) {
        return Response.success([]);
    }

    if (!obj || obj.code !== 200 || !obj.data || !obj.data.data) {
        return Response.success([]);
    }

    var commentList = obj.data.data.comment;
    if (!commentList || !Array.isArray(commentList)) {
        return Response.success([]);
    }

    var comments = [];
    for (var i = 0; i < commentList.length; i++) {
        var c = commentList[i];
        if (!c) continue;

        var name = c.user_info ? c.user_info.user_name : "Thành viên";
        var content = c.text || "";

        comments.push({
            name: decodeText(name),
            content: decodeText(cleanText(content)),
            description: formatTime(c.create_timestamp)
        });

        // Parse nested reply list
        if (c.reply_list && Array.isArray(c.reply_list)) {
            for (var j = 0; j < c.reply_list.length; j++) {
                var reply = c.reply_list[j];
                if (!reply) continue;
                
                var rName = reply.user_info ? reply.user_info.user_name : "Thành viên";
                var rContent = reply.text || "";

                comments.push({
                    name: "  ↳ " + decodeText(rName),
                    content: decodeText(cleanText(rContent)),
                    description: formatTime(reply.create_timestamp)
                });
            }
        }
    }

    var next = null;
    if (obj.data.data.has_more && obj.data.data.next_offset) {
        next = String(obj.data.data.next_offset);
    }

    return Response.success(comments, next);
}
