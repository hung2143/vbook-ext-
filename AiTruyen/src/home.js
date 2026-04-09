// home.js - Trang chủ AI Truyện
// Trả về danh sách mục nguồn cấp dữ liệu
function execute() {
    return Response.success([
        {
            title: "Truyện mới cập nhật",
            input: "https://aitruyen.net/?sort=latest&page=",
            script: "gen.js"
        },
        {
            title: "Truyện hot",
            input: "https://aitruyen.net/?sort=views&page=",
            script: "gen.js"
        },
        {
            title: "Truyện hoàn thành",
            input: "https://aitruyen.net/?status=completed&page=",
            script: "gen.js"
        }
    ]);
}
