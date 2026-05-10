var HOST = "https://sto55.com";

function execute() {
    return Response.success([
        { title: "男生频道", input: HOST + "/list_1_1.html", script: "book.js" },
        { title: "女生频道", input: HOST + "/list_2_1.html", script: "book.js" },
        { title: "最新更新", input: HOST + "/top/lastupdate_1.html", script: "latest.js" },
        { title: "总点击榜", input: HOST + "/top/hits_1.html", script: "latest.js" },
        { title: "总推荐榜", input: HOST + "/top/recommend_1.html", script: "latest.js" },
        { title: "总收藏榜", input: HOST + "/top/collect_1.html", script: "latest.js" }
    ]);
}
