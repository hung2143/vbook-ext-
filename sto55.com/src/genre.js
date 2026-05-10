var HOST = "https://sto55.com";

function execute() {
    return Response.success([
        { title: "玄幻奇幻", input: HOST + "/list_1_1.html", script: "book.js" },
        { title: "武侠仙侠", input: HOST + "/list_3_1.html", script: "book.js" },
        { title: "都市言情", input: HOST + "/list_4_1.html", script: "book.js" },
        { title: "历史军事", input: HOST + "/list_5_1.html", script: "book.js" },
        { title: "科幻游戏", input: HOST + "/list_6_1.html", script: "book.js" },
        { title: "悬疑灵异", input: HOST + "/list_7_1.html", script: "book.js" },
        { title: "轻小说", input: HOST + "/list_8_1.html", script: "book.js" }
    ]);
}
