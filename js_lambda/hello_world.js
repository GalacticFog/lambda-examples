function hello(event, context) {
	// Call the console.log function.
	console.log("Hello World");
	var env = java.lang.System.getenv();
	var test = env.get("ENV_TEST");
	return "<html><head></head><body><h1><center>HELLO WORLD INLINE CODE!! - " + test + " <hr></h1><br><h4>Serverless webpage!!!</h4><br><blink>w00t</blink></center></body></html>";
};
