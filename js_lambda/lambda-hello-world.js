function run(data,ctx) {
    data = JSON.parse(data);
    ctx = JSON.parse(ctx);
    if (ctx.method === "POST") {
        return doUpper(data);
    } else {
        return ux;
    }
}

function doUpper(data) {
    return data.toUpperCase();
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
    $("#makeUpper").click(function(){
        $.ajax("#",{
            data: JSON.stringify({
                eventName: "",
                data: $("#data").val()
            }),
            method: "POST",
            processData: false,
            contentType: "application/json",
            dataType: "html"
         }).done(function(data){
            $("#data").val(data);
        });
    });
});
 </script>
 </head>
 <body>

 <h1>Lambda Composition Example</h1>

 <textarea cols="100" rows="20" id="data"></textarea>
 <p>
 <button id="makeUpper">Execute upperCase() lambda</button>

 </body>
 </html>
 **/});
