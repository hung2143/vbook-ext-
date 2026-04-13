// genre.js - Danh sách 19 thể loại truyện AiTruyen
// Trả về {title, input, script} — giống home.js, mỗi item là một thể loại
// Khi ấn vào thể loại vBook gọi gen.js(input, page) để lấy danh sách truyện
function execute() {
    return Response.success([
        {title: "Huyền Huyễn",          input: "?genre=huyen-huyen",           script: "gen.js"},
        {title: "Hiện Đại Ngôn Tình",   input: "?genre=hien-ai-ngon-tinh",    script: "gen.js"},
        {title: "Đô Thị",               input: "?genre=o-thi",                 script: "gen.js"},
        {title: "Đồng Nhân",            input: "?genre=ong-nhan",              script: "gen.js"},
        {title: "Cổ Đại Ngôn Tình",     input: "?genre=co-ai-ngon-tinh",      script: "gen.js"},
        {title: "Tiên Hiệp",            input: "?genre=tien-hiep",             script: "gen.js"},
        {title: "Huyền Huyễn Ngôn Tình",input: "?genre=huyen-huyen-ngon-tinh",script: "gen.js"},
        {title: "Dã Sử",                input: "?genre=da-su",                 script: "gen.js"},
        {title: "Võng Du",              input: "?genre=vong-du",               script: "gen.js"},
        {title: "Khoa Huyễn",           input: "?genre=khoa-huyen",            script: "gen.js"},
        {title: "Khoa Huyễn Không Gian",input: "?genre=khoa-huyen-khong-gian", script: "gen.js"},
        {title: "Kỳ Ảo",               input: "?genre=ky-ao",                  script: "gen.js"},
        {title: "Tiên Hiệp Kỳ Duyên",  input: "?genre=tien-hiep-ky-duyen",   script: "gen.js"},
        {title: "Huyền Nghi",           input: "?genre=huyen-nghi",            script: "gen.js"},
        {title: "Kiếm Hiệp",            input: "?genre=kiem-hiep",             script: "gen.js"},
        {title: "Cạnh Kỹ",              input: "?genre=canh-ky",               script: "gen.js"},
        {title: "Huyền Nghi Thần Quái", input: "?genre=huyen-nghi-than-quai",  script: "gen.js"},
        {title: "Light Novel",          input: "?genre=light-novel",           script: "gen.js"},
        {title: "Lãng Mạn Thanh Xuân",  input: "?genre=lang-man-thanh-xuan",   script: "gen.js"}
    ]);
}
