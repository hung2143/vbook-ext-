// home.js - Trang chủ AI Truyện
function execute() {
    return Response.success([
        {title: "Truyện thịnh hành", input: "?type=thinh-hanh", script: "gen.js"},
        {title: "Truyện mới cập nhật", input: "?type=cap-nhat", script: "gen.js"},
        {title: "Truyện tân binh", input: "?type=tan-binh", script: "gen.js"}
    ]);
}
