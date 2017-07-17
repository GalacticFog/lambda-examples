package com.galacticfog.test;

import org.json.simple.parser.JSONParser;
import org.json.simple.JSONObject;

import java.io.DataOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class JavaTestLambda {

	StringBuilder outString = new StringBuilder();

	public void log( String thing ) {
		outString.append( thing );
		System.out.println( thing );
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
}

