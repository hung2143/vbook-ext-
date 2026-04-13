// home.js - Trang chủ AI Truyện
function execute() {
    return Response.success([
        {
            title: "Truyện thịnh hành",
            input: "https://aitruyen.net/bang-xep-hang?type=thinh-hanh",
            script: "gen.js"
        },
        {
            title: "Truyện mới cập nhật",
            input: "https://aitruyen.net/bang-xep-hang?type=cap-nhat",
            script: "gen.js"
        },
        {
            title: "Truyện tân binh",
            input: "https://aitruyen.net/bang-xep-hang?type=tan-binh",
            script: "gen.js"
        }
    ]);
}
