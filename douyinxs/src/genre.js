function execute() {
    return Response.success([
        { title: "全部分类", input: "/fenlei/", script: "gen.js" },
        { title: "玄奇", input: "/fenlei/1/", script: "gen.js" },
        { title: "高武", input: "/fenlei/2/", script: "gen.js" },
        { title: "修仙", input: "/fenlei/3/", script: "gen.js" },
        { title: "都市", input: "/fenlei/4/", script: "gen.js" },
        { title: "军事", input: "/fenlei/5/", script: "gen.js" },
        { title: "历史", input: "/fenlei/6/", script: "gen.js" },
        { title: "游体", input: "/fenlei/7/", script: "gen.js" },
        { title: "科幻", input: "/fenlei/8/", script: "gen.js" },
        { title: "恐怖", input: "/fenlei/9/", script: "gen.js" },
        { title: "次元", input: "/fenlei/0/", script: "gen.js" },
        { title: "女生", input: "/fenlei/", script: "gen.js" },
    ]);
}
