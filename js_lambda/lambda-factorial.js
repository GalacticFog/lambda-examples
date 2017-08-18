function run(data,ctx) {
    data = JSON.parse(data);
    ctx = JSON.parse(ctx);
    if (ctx.method === "POST") {
        return factorial(data).toString();
    } else {
        return ux;
    }
}

function factorial(data) {
    if ( data === 1 ) return 1;
    if ( data < 1 ) return "undefined";
    return data * factorial(data-1);
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
    $("#computeFactorial").click(function(){
        var arg = $("#arg").val();
        $.ajax("#",{
            data: JSON.stringify({
                eventName: "",
                data: parseInt(arg)
            }),
            method: "POST",
            processData: false,
            contentType: "application/json",
            dataType: "html"
         }).done(function(data){
            $("#result").html("Factorial of " + arg + " is " + data);
        });
    });
});
 </script>
 </head>
 <body>

 <h1>Simple Lambda Example</h1>

 <input type="text" name="arg" id="arg" />
 <br/>
 <button id="computeFactorial">Compute Factorial</button>

 <br/>

 <div id="result"></div>

 </body>
 </html>
 **/});
