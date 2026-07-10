function execute() {
    // Các bảng đầu dùng số đọc, điểm và thời gian cập nhật mà API công khai trả về.
    // Đề xuất cá nhân hoá của QQ Browser không công khai, nên "精选" được xếp theo
    // điểm và lượt đọc của các nhóm truyện lớn thay vì giả lập một feed đăng nhập.
    return Response.success([
        // Đặt feed nhẹ lên đầu để khi mở extension chỉ cần hai request danh mục;
        // danh sách cập nhật toàn trang vẫn giữ ngay bên cạnh để người dùng chọn.
        { title: "全站・热门阅读", input: "mode=reads", script: "feed.js" },
        { title: "全站・最新更新", input: "mode=updated_all", script: "feed.js" },
        { title: "BXH・最新更新", input: "mode=updated", script: "feed.js" },
        { title: "完本・随机推荐", input: "mode=random_finished", script: "feed.js" },
        { title: "精选推荐・男频", input: "mode=recommend_male", script: "feed.js" },
        { title: "精选推荐・女频", input: "mode=recommend_female", script: "feed.js" },
        { title: "全站・高分作品", input: "mode=score", script: "feed.js" },
        { title: "全站・完本精选", input: "mode=finished", script: "feed.js" },
        { title: "男频・玄幻热门", input: "groupid=1501&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "男频・都市热门", input: "groupid=1505&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "男频・仙侠热门", input: "groupid=1504&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "女频・古言热门", input: "groupid=1523&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "女频・现言热门", input: "groupid=1524&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "女频・幻情热门", input: "groupid=1516&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "二次元热门", input: "groupid=1512&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "短篇热门", input: "groupid=1515&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" },
        { title: "出版・文学热门", input: "groupid=1461&start={{page}}&count=20&sort=0&sub=&tag=&words=&finish=", script: "gen.js" }
    ]);
}
