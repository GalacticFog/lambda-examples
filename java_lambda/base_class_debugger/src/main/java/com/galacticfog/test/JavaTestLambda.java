package com.galacticfog.test;

import org.json.simple.parser.JSONParser;
import org.json.simple.JSONObject;
import org.slf4j.LoggerFactory;
import org.slf4j.Logger;

import java.io.DataOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class JavaTestLambda extends BaseLambda {

	StringBuilder outString = new StringBuilder();
	Logger log = LoggerFactory.getLogger( this.getClass() );

	public void log( String thing ) {
		outString.append( thing );
		log.debug( thing );
	}

	public String getLog() {
		return outString.toString();
	}

	public String hello( String payload, String context ) {

		try {
			log("Event :  ");
			log("\t " + payload );
			log("\nContext : " );
			log( context );

			return getLog();
		}
		catch( Exception e )  {
			e.printStackTrace();
			System.out.println( "FAILED : " + e.getMessage() );
			return "FAILURE";
		}
	}

	public String by( String payload, String context ) {
	    return "bye bye";
	}

	private String nono( String payload, String context ) {
		return "no no dis bad";
	}
}

