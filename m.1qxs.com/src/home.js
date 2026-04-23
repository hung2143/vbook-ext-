var HOST = "https://m.1qxs.com";

function execute() {
    return Response.success([
        { title: "男生频道", input: HOST + "/xclass_1/0/1.html", script: "book.js" },
        { title: "女生频道", input: HOST + "/xclass_2/0/1.html", script: "book.js" },
        { title: "最新更新", input: HOST + "/top_1/0/1.html", script: "latest.js" },
        { title: "排行榜", input: HOST + "/top_1/1/1.html", script: "latest.js" }
    ]);
}