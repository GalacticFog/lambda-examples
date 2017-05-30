var baseUrl = "http://lambda-provider.services.default-laser-provider.root.demo8-1.1.0.marathon.l4lb.thisdcos.directory:9000/lambdas/";
var lamText = "19c8ea24-92dc-4c05-998b-4497f5199407";
var lamUpper = "ebbefa66-f29b-4319-9624-cf892a4ea7b5";
var lamLower = "bdc27050-4575-4d41-a5a1-27379d3d85b9";
var client = new org.asynchttpclient.DefaultAsyncHttpClient();

function run(data,ctx) {
    console.log(data);
    console.log(ctx);
    ctx = JSON.parse(ctx);
    if ( ctx.params.whch != null ) {
        // lambda if-composition
        switch (ctx.params.whch[0]) {
            case "lorem":
                return compose(lamText, null);
            case "upper":
                return compose(lamText, lamUpper);
            case "lower":
                return compose(lamText, lamLower);
            default:
                return "invalid option";
        }
    } else return ux;
}

function compose(first, second) {
    var firstUrl = baseUrl + first + "/invokeSync";
    var secondUrl = baseUrl + second + "/invokeSync";
    var resp =  _POST(firstUrl, {
        eventName: '',
        data: {}
    });

    if (second == null) return resp;

    return _POST(secondUrl, {
        eventName: '',
        data: resp
    });
}



/// UX component

var MultiString = function(f) {
    return f.toString().split('\n').slice(1, -1).join('\n');
}

var ux = MultiString(function() {/**
 <!DOCTYPE html>
 <html>
 <head>
 <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
 <script>
 $(document).ready(function(){
    $("#lorem").click(function(){
        $("textarea#result").val("invoking lambda...");
        $.get("#", {whch: "lorem"}, function(data, status){
            $("textarea#result").val(data);
        });
    });
    $("#upper").click(function(){
        $("textarea#result").val("invoking lambda...");
        $.get("#", {whch: "upper"}, function(data, status){
            $("textarea#result").val(data);
        });
    });
    $("#lower").click(function(){
        $("textarea#result").val("invoking lambda...");
        $.get("#", {whch: "lower"}, function(data, status){
            $("textarea#result").val(data);
        });
    });
});
 </script>
 </head>
 <body>

 <h1>Lambda Composition Example</h1>

 Pick a function, any function:
 <ul>
 <li><button id="lorem">lorem</button>
 <li><button id="upper">upper compose lorem</button>
 <li><button id="lower">lower compose lorem</button>
 </ul>
 <textarea cols="100" rows="20" id="result"></textarea>

 </body>
 </html>
 **/});

function _POST(url, payload) {
    var pc = client.prepareConnect(url)
        .setMethod("POST")
        .setBody(JSON.stringify(payload))
        .addHeader("Content-Type", "application/json");
    return _handleResponse(pc.execute().get());
}

function _handleResponse(response) {
    var code = response.getStatusCode();
    var body = response.getResponseBody();
    if (code == 404) {
        return null;
    } else if (code >= 300) {
        log("WARNING: status code " + code + " from " + response.getUri());
        log("response: " + body);
        throw code;
    } else if (code == 204) {
        return null;
    }
    if (response.getContentType().startsWith("application/json")) return JSON.parse(body);
    return body;
}
