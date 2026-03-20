function execute() {
    return Response.success([
        { title: "Mới cập nhật", input: "https://trangtruyen.site/stories?page=", script: "gen.js" },
        { title: "Phổ biến (lượt xem)", input: "https://trangtruyen.site/stories?sort=views&page=", script: "gen.js" },
        { title: "Hoàn thành", input: "https://trangtruyen.site/stories?status=completed&page=", script: "gen.js" }
    ]);
}
