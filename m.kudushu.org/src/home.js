var HOST = "https://m.kudushu.org";

function execute() {
    return Response.success([
        { title: "Xep hang", input: HOST + "/top/allvisit/1.html", script: "book.js" },
        { title: "Moi nhat", input: HOST + "/top/postdate/1.html", script: "book.js" },
        { title: "Hoan thanh", input: HOST + "/fulltop/allvisit/1.html", script: "book.js" },
        { title: "Cap nhat", input: HOST + "/top/lastupdate/1.html", script: "book.js" },
        { title: "The loai", input: HOST + "/modules/article/sortselect.php", script: "genre.js" }
    ]);
}
