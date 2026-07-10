var HOST = "https://sto55.com";

function execute() {
    return Response.success([
        { title: "玄幻奇幻", input: HOST + "/class_1_1.html", script: "book.js" },
        { title: "武俠仙俠", input: HOST + "/class_2_1.html", script: "book.js" },
        { title: "現代都市", input: HOST + "/class_3_1.html", script: "book.js" },
        { title: "歷史軍事", input: HOST + "/class_4_1.html", script: "book.js" },
        { title: "科幻小說", input: HOST + "/class_5_1.html", script: "book.js" },
        { title: "遊戲競技", input: HOST + "/class_6_1.html", script: "book.js" },
        { title: "恐怖靈異", input: HOST + "/class_7_1.html", script: "book.js" },
        { title: "言情小說", input: HOST + "/class_8_1.html", script: "book.js" },
        { title: "其他類型", input: HOST + "/class_9_1.html", script: "book.js" }
    ]);
}
