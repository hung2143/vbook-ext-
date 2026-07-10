var HOST = "https://m.kudushu.org";

function execute() {
    return Response.success([
        { title: "Phân loại", input: HOST + "/modules/article/sortselect.php", script: "genre.js" },
        { title: "Mới cập nhật", input: HOST + "/top/lastupdate/1.html", script: "book.js" },
        { title: "Mới vào kho", input: HOST + "/top/postdate/1.html", script: "book.js" },
        { title: "Truyện hoàn", input: HOST + "/fulltop/allvisit/1.html", script: "book.js" },
        { title: "Tổng xếp hạng", input: HOST + "/modules/article/top.php", script: "book.js" }
    ]);
}
