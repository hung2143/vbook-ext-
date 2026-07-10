function execute() {
    // rank/list là endpoint công khai hiện tại của QQ阅读. Mỗi mục bên dưới
    // đã được kiểm tra có dữ liệu, thay vì giả lập các feed cá nhân hoá.
    return Response.success([
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
