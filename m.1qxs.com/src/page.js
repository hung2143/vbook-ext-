var HOST = "https://m.1qxs.com";

function execute(url) {
    // Extract book ID
    var bookIdMatch = url.match(/\/xs_1\/(\d+)/);
    if (!bookIdMatch) return null;
    var bookId = bookIdMatch[1];

    // Pages are defined by catalog page sections
    // Return catalog page with all chapters
    return Response.success([
        HOST + "/catalog_1/" + bookId
    ]);
}