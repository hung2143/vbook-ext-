function execute() {
    return Response.success([
        { title: "Trang chủ", input: "https://khotruyenchu.sbs/page/", script: "gen.js" },
        { title: "Top Qidian", input: "https://khotruyenchu.sbs/top-qidian/page/", script: "gen.js" },
        { title: "Độc giả yêu cầu", input: "https://khotruyenchu.sbs/yeu-cau-dich/page/", script: "gen.js" }
    ]);
}
