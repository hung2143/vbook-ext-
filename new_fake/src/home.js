load("config.js");

function execute() {
    return Response.success([
        { title: "巅峰榜", input: getUrl("/api/discover?tab=小说&bdtype=巅峰榜&gender=1&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[男] 推荐榜", input: getUrl("/api/discover?tab=小说&bdtype=推荐榜&gender=1&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[女] 推荐榜", input: getUrl("/api/discover?tab=小说&bdtype=推荐榜&gender=0&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[男] 热搜榜", input: getUrl("/api/discover?tab=小说&bdtype=热搜榜&gender=1&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[女] 热搜榜", input: getUrl("/api/discover?tab=小说&bdtype=热搜榜&gender=0&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[男] 完结榜", input: getUrl("/api/discover?tab=小说&bdtype=完结榜&gender=1&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[女] 完结榜", input: getUrl("/api/discover?tab=小说&bdtype=完结榜&gender=0&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[男] 黑马榜", input: getUrl("/api/discover?tab=小说&bdtype=黑马榜&gender=1&is_ranking=1&page={{page}}"), script: "gen.js" },
        { title: "[女] 黑马榜", input: getUrl("/api/discover?tab=小说&bdtype=黑马榜&gender=0&is_ranking=1&page={{page}}"), script: "gen.js" }
    ]);
}
