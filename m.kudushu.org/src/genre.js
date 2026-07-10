var HOST = "https://m.kudushu.org";

// Danh sách này khớp đủ 18 thể loại đang hiển thị trên Kudushu.
var GENRES = [
    { title: "Huyền huyễn ma pháp", id: 1 },
    { title: "Võ hiệp tu chân", id: 2 },
    { title: "Đô thị ngôn tình", id: 3 },
    { title: "Lịch sử quân sự", id: 4 },
    { title: "Trinh thám suy luận", id: 5 },
    { title: "Võng du hoạt hình", id: 6 },
    { title: "Khoa huyễn tiểu thuyết", id: 7 },
    { title: "Khủng bố linh dị", id: 8 },
    { title: "Ngôn tình tiểu thuyết", id: 9 },
    { title: "Thể loại khác", id: 10 },
    { title: "Kinh bộ", id: 11 },
    { title: "Sử thư", id: 12 },
    { title: "Tử bộ", id: 13 },
    { title: "Tập bộ", id: 14 },
    { title: "Ngoài Tứ khố", id: 15 },
    { title: "Sách cổ điển", id: 16 },
    { title: "Thơ ca", id: 17 },
    { title: "Tống từ", id: 18 }
];

function execute() {
    var data = [];

    GENRES.forEach(function(genre) {
        data.push({
            title: genre.title + " - Mới cập nhật",
            input: HOST + "/sort/" + genre.id + "/1.html",
            script: "book.js"
        });
        data.push({
            title: genre.title + " - Lượt đọc tháng",
            input: HOST + "/top/monthvisit/1.html?sortid=" + genre.id,
            script: "book.js"
        });
    });

    return Response.success(data);
}
