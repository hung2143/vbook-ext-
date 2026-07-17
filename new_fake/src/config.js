let BASE_URL = "http://101.35.133.34:5000";
try {
    if (CONFIG_URL) {
        BASE_URL = CONFIG_URL;
    }
} catch (e) {}

var BASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getUrl(path) {
    var base = BASE_URL || "http://101.35.133.34:5000";
    var match = base.match(/^(https?:\/\/[^\/]+)/);
    if (match) {
        base = match[1];
    }
    if (!path) return base;
    if (path.indexOf("http") === 0) return path;
    if (path.charAt(0) !== "/") {
        path = "/" + path;
    }
    return base + path;
}

function fetchPage(url, options) {
    if (!options) options = {};
    if (options.queries) {
        var queryParts = [];
        for (var key in options.queries) {
            if (options.queries.hasOwnProperty(key)) {
                var val = options.queries[key];
                if (val !== undefined && val !== null) {
                    queryParts.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
                }
            }
        }
        if (queryParts.length > 0) {
            var separator = url.indexOf("?") !== -1 ? "&" : "?";
            url = url + separator + queryParts.join("&");
        }
        delete options.queries;
    }
    var headers = {
        'User-Agent': BASE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Referer': BASE_URL + '/'
    };
    if (options.headers) {
        for (var k in options.headers) {
            headers[k] = options.headers[k];
        }
    }
    options.headers = headers;
    if (!options.hasOwnProperty("timeout")) {
        options.timeout = 10000;
    }
    return fetch(url, options);
}

if (typeof Response === 'undefined') {
    var Response = {
        success: function(data, data2) {
            return JSON.stringify({ code: 0, data: data, data2: data2 });
        },
        error: function(data) {
            return JSON.stringify({ code: 1, data: data });
        }
    };
}

function SafeJson(response) {
    if (!response) return null;
    try {
        if (typeof response.json === 'function') return response.json();
        if (typeof response.text === 'function') return JSON.parse(response.text());
        if (typeof response.string === 'function') return JSON.parse(response.string());
        return JSON.parse(response);
    } catch (e) { return null; }
}


function cleanText(text) {
    if (text === undefined || text === null) return "";
    return String(text).replace(/\s+/g, " ").trim();
}

function getBookId(url) {
    if (!url) return "";
    var match = url.match(/page\/(\d+)/) || url.match(/book_id=(\d+)/) || url.match(/(\d+)/);
    return match ? match[1] : "";
}

function decodeText(text) {
    if (!text) return "";
    var str = String(text);
    var CODE_ST = 58344, CODE_ED = 58715;
    var charset = ["体","y","十","现","快","便","话","却","月","物","水","的","放","知","爱","万","","表","风","理","O","老","也","p","常","克","平","几","最","主","她","s","将","法","情","o","光","a","我","呢","J","员","太","每","望","受","教","w","利","军","已","U","人","如","变","得","要","少","斯","门","电","m","男","没","A","K","国","时","中","走","么","何","口","小","向","问","轻","T","d","神","下","间","车","f","G","度","D","又","大","面","远","就","写","j","给","通","起","实","E","","它","去","S","到","道","数","吃","们","加","P","是","无","把","事","西","多","界","","发","新","外","活","解","孩","只","作","前","Y","尔","经","","u","心","告","父","等","Q","民","全","这","9","果","安","","i","母","8","r","说","任","先","和","地","C","张","战","场","g","像","c","q","你","使","","样","总","目","x","性","处","音","头","","应","乐","关","能","花","l","当","名","手","4","重","字","声","力","友","然","生","代","内","里","本","回","真","入","师","象","","0","点","R","亲","V","种","动","英","命","Z","h","X","做","特","边","高","有","B","为","期","自","年","马","认","出","接","至","H","正","方","感","所","明","者","稜","F","住","学","还","分","意","更","其","n","但","比","觉","以","由","死","家","让","失","士","L","2","I","金","叫","身","报","听","w","再","原","山","海","白","很","见","5","直","位","第","工","个","开","岁","好","用","都","于","可","同","3","次","四","","日","信","与","女","笑","满","并","部","什","不","从","或","机","此","","了","记","三","e","些","b","N","夫","会","才","儿","眼","两","美","被","一","公","来","立","z","长","对","己","看","k","许","因","相","色","后","往","打","结","格","过","世","气","7","子","条","在","书","之","定","v","拉","成","进","带","着","东","上","想","天","他","妈","1","文","而","路","那","别","德","6","M","t","行","侯","难"];
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
