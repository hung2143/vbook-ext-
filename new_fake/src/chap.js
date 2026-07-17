load("config.js");

function decodeText(text) {
    if (!text) return "";
    var str = String(text);
    var CODE_ST = 58344, CODE_ED = 58715;
    var charset = ["体","y","十","现","快","便","话","却","月","物","水","的","放","知","爱","万","","表","风","理","O","老","也","p","常","克","平","几","最","主","她","s","将","法","情","o","光","a","我","呢","J","員","太","每","望","受","教","w","利","军","已","U","人","如","变","得","要","少","斯","门","电","m","男","没","A","K","国","时","中","走","么","何","口","小","向","问","light","T","d","神","下","间","车","f","G","度","D","又","大","面","远","就","写","j","給","通","起","实","E","","มัน","ไป","S","ถึง","ทาง","เลข","กิน","พวก","เพิ่ม","P","(","đã","được","thêm","hỏi","trả","lời","gợi","ý","","phát","mới","ngoài","sống","giải","đứa trẻ","chỉ","làm","trước","Y","nhĩ","kinh","","u","tâm","báo","cha","chờ","Q","dân","hết","này","9","quả","an","","i","mẹ","8","r","nói","nhiệm","trước","và","đất","C","trương","chiến","trường","g","giống","c","q","bạn","sử dụng","","dạng","tổng","mục","x","tính","nơi","âm","đầu","","nên","nhạc","quan","năng","hoa","l","đương","danh","tay","4","trọng","chữ","tiếng","lực","bạn","nhiên","sinh","đại","trong","ở","bản","về","thật","vào","thầy","tượng","","0","điểm","R","thân","V","loại","động","anh","mạng","Z","h","X","làm","đặc","bên","cao","có","B","vì","kỳ","tự","năm","ngựa","nhận","ra","tiếp","đến","H","đúng","hướng","cảm","nơi","rõ","người","lăng","F","ở","học","còn","phân","ý","hơn","kỳ","n","nhưng","so","nghĩ","để","do","chết","nhà","let","mất","sĩ","L","2","I","vàng","gọi","thân","báo","nghe","W","lại","nguyên","núi","biển","trắng","rất","thấy","5","thẳng","vị","thứ","công","cá","mở","tuổi","tốt","dùng","đều","ở","có thể","cùng","3","lần","bốn","","ngày","tin","với","nữ","cười","đầy","bộ","gì","không","từ","hoặc","máy","này","","rồi","ghi","ba","e","những","b","N","chồng","sẽ","mới","con","mắt","hai","đẹp","bị","một","công","đến","lập","z","dài","đối","mình","xem","k","hứa","do","tương","màu","sau","hướng","đánh","kết","cách","qua","thế","khí","7","con","điều","thám","sách","của","định","v","kéo","thành","tiến","mang","mặc","đông","trên","nghĩ","trời","nó","mẹ","1","văn","mà","đường","kia","khác","đức","6","M","t","đi","lúc","khó"];
    var result = [];
    for (var i = 0; i < str.length; i++) {
        var cc = str.charCodeAt(i);
        if (cc >= CODE_ST && cc <= CODE_ED) {
            var bias = cc - CODE_ST;
            if (bias >= 0 && bias < charset.length && charset[bias]) {
                result.push(charset[bias]);
            } else { result.push(str.charAt(i)); }
        } else { result.push(str.charAt(i)); }
    }
    return result.join("");
}

function execute(url) {
    var itemId = "";
    var match = url.match(/item_ids?=([^&]+)/) || url.match(/\/reader\/(\d+)/) || url.match(/\/page\/(\d+)/) || url.match(/(\d+)/);
    if (match) {
        itemId = decodeURIComponent(match[1]);
        if (itemId.indexOf(",") !== -1) {
            itemId = itemId.split(",")[0];
        }
    }

    if (!itemId) {
        return Response.error("Invalid chapter item ID");
    }

    var contentUrl = getUrl("/api/content") + "?tab=小说&item_id=" + itemId;
    var response = fetch(contentUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*"
        },
        timeout: 10000
    });

    if (!response || !response.ok) {
        return Response.error("Failed to load chapter content.");
    }

    var obj = SafeJson(response);
    if (!obj) {
        return Response.error("Empty response or parse failed");
    }

    var content = "";
    if (obj.code === 200 && obj.data) {
        if (typeof obj.data === "string") {
            content = obj.data;
        } else if (typeof obj.data.content === "string") {
            content = obj.data.content;
        } else if (typeof obj.data.text === "string") {
            content = obj.data.text;
        }
    } else if (typeof obj.content === "string") {
        content = obj.content;
    }

    if (!content) {
        return Response.error("Cannot load chapter content. Unauthorized or server error.");
    }

    content = decodeText(content);

    var htmlContent = content.split(/\r?\n/).join("<br>");

    if (!htmlContent) {
        return Response.error("Empty chapter text");
    }

    return Response.success(htmlContent);
}
