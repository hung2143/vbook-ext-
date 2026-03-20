function execute(url, page) {
    // Bọc toàn bộ logic trong try để nếu có lỗi
    // (do DOM khác, regex sai, v.v.) thì vẫn trả về
    // 1 item debug, giúp app không hiện "Không có dữ liệu".
    try {
        if (!page) page = '1';
        var listUrl = url + page;
        var response = fetch(listUrl);
        if (!response.ok) {
            return Response.success([{
                name: 'TrangTruyen: fetch lỗi',
                link: 'https://trangtruyen.site/stories',
                cover: '',
                description: 'Không gọi được ' + listUrl,
                host: 'https://trangtruyen.site'
            }], null);
        }

        var doc = response.html('utf-8');
        if (!doc) {
            return Response.success([{
                name: 'TrangTruyen: doc trống',
                link: 'https://trangtruyen.site/stories',
                cover: '',
                description: 'Không parse được HTML',
                host: 'https://trangtruyen.site'
            }], null);
        }

        var data = [];

        // Trên trang /stories, các truyện đều có link dạng
        // https://trangtruyen.site/stories/slug-...
        var items = doc.select("a[href^='https://trangtruyen.site/stories/'], a[href^='/stories/']");

        var seen = {};
        items.forEach(function (a) {
            var link = a.attr('href');
            if (!link) return;
            if (!link.startsWith('http')) link = 'https://trangtruyen.site' + link;
            if (seen[link]) return;
            seen[link] = true;

            var name = a.text();
            if (!name) name = a.attr('title');

            data.push({
                name: name,
                link: link,
                cover: '',
                description: '',
                host: 'https://trangtruyen.site'
            });
        });

        // Nếu selector không bắt được gì (do DOM khác bản desktop),
        // fallback dùng regex quét toàn bộ HTML để lấy link truyện
        // cả dạng tuyệt đối lẫn tương đối.
        if (data.length === 0) {
            var html = doc.html();
            var regex = /(https:\/\/trangtruyen\.site\/stories\/[^"'>\s]+|\/stories\/[^"'>\s]+)/g;
            var m;
            while ((m = regex.exec(html)) !== null) {
                var link2 = m[0];
                if (!link2.startsWith('http')) link2 = 'https://trangtruyen.site' + link2;
                if (seen[link2]) continue;
                seen[link2] = true;

                var slug = link2.split('/').pop();
                var name2 = decodeURIComponent(slug.replace(/-/g, ' '));

                data.push({
                    name: name2,
                    link: link2,
                    cover: '',
                    description: '',
                    host: 'https://trangtruyen.site'
                });
            }

            // Nếu vẫn không có gì, trả về 1 dòng debug để biết plugin chạy.
            if (data.length === 0) {
                data.push({
                    name: 'TrangTruyen: không tìm thấy truyện',
                    link: 'https://trangtruyen.site/stories',
                    cover: '',
                    description: 'HTML length: ' + html.length + ' | has "/stories/": ' + (html.indexOf('/stories/') !== -1),
                    host: 'https://trangtruyen.site'
                });
            }
        }

        var next = null;
        return Response.success(data, next);
    } catch (e) {
        // Fallback cuối cùng: luôn trả về 1 item tĩnh.
        return Response.success([
            {
                name: 'TrangTruyen: lỗi script',
                link: 'https://trangtruyen.site/stories',
                cover: '',
                description: 'Plugin gặp lỗi, cần xem lại code.',
                host: 'https://trangtruyen.site'
            }
        ], null);
    }
}
