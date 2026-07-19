function execute() {
    return Response.success([
        { title: "[Nam]-đổi mới", input: "mode=updated", script: "feed.js" },
        { title: "[Nam]-lượt đọc", input: "mode=reads", script: "feed.js" },
        { title: "[Nam]-điểm cao", input: "mode=score", script: "feed.js" },
        { title: "[Nam]-hoàn thành", input: "mode=finished", script: "feed.js" }
    ]);
}
