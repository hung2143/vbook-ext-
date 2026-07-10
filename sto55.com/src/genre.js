var HOST = "https://sto55.com";

function execute() {
    var categories = [
        { title: "玄幻奇幻", id: 1 },
        { title: "武俠仙俠", id: 2 },
        { title: "現代都市", id: 3 },
        { title: "歷史軍事", id: 4 },
        { title: "科幻小說", id: 5 },
        { title: "遊戲競技", id: 6 },
        { title: "恐怖靈異", id: 7 },
        { title: "言情小說", id: 8 },
        { title: "其他類型", id: 9 }
    ];
    var data = [];

    categories.forEach(function(category) {
        var baseUrl = HOST + "/shuku/0/" + category.id + "/0/0/0/0/";
        data.push({
            title: category.title + " - 最新更新",
            input: baseUrl + "lastupdate/1.html",
            script: "book.js"
        });
        data.push({
            title: category.title + " - 月點擊榜",
            input: baseUrl + "monthvisit/1.html",
            script: "book.js"
        });
    });

    return Response.success(data);
}
