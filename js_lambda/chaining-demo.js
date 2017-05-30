function run(data,ctx) {
    console.log(data);
    console.log(ctx);
    ctx = JSON.parse(ctx);
    if ( ctx.params.whch != null ) {
        return chain(ctx.params.whch);
    } else return ux;
}

function chain(whch) {
    var baseUrl = "http://lambda-provider.services.default-laser-provider.root.demo8-1.1.0.marathon.l4lb.thisdcos.directory:9000/lambdas/";
    var lamText = "19c8ea24-92dc-4c05-998b-4497f5199407";
    switch (whch[0]) {
        case "upper":
            return "upper";
        case "lower":
            return "lower";
        default:
            return "invalid option";
    }
}

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
    $("#upper").click(function(){
        $.get("#", {whch: "upper"}, function(data, status){
            $("textarea#result").val(data);
        });
    });
    $("#lower").click(function(){
        $.get("#", {whch: "lower"}, function(data, status){
            $("textarea#result").val(data);
        });
    });
});
 </script>
 </head>
 <body>

 <h1>Lambda Composition Example</h1>

 Pick your poison:
 <ul>
 <li><button id="upper">upper compose getText</button>
 <li><button id="lower">lower compose getText</button>
 </ul>
 <textarea cols="100" rows="20" id="result"></textarea>

 </body>
 </html>
 **/});
