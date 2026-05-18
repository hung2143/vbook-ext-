var HOST = "https://sto55.com";

function execute() {
    return Response.success([
        { title: "Nam sinh băng tán", input: HOST + "/class_1_1.html", script: "book.js" },
        { title: "Nữ sinh băng tán", input: HOST + "/class_2_1.html", script: "book.js" },
        { title: "Mới nhất đổi mới", input: HOST + "/top/lastupdate_1.html", script: "latest.js" },
        { title: "Bảng tổng click", input: HOST + "/top/allvisit_1.html", script: "latest.js" },
        { title: "Bảng đề xuất", input: HOST + "/top/recommend_1.html", script: "latest.js" },
        { title: "Bảng yêu thích", input: HOST + "/top/collect_1.html", script: "latest.js" }
    ]);
}
