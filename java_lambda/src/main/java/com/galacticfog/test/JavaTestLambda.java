package com.galacticfog.test;

import org.json.simple.parser.JSONParser;
import org.json.simple.JSONObject;

import java.io.DataOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class JavaTestLambda {

	public String call( String payload, String context ) {

		try {

			// Call the System.out.println function.
			System.out.println("Calling ");
			JSONParser parser = new JSONParser();
			JSONObject eventData = (JSONObject)parser.parse( payload );

			String url = "https://api.twilio.com/2010-04-01/Accounts/" + (String)eventData.get( "accountSid" ) + "/Calls.json";
			URL obj = new URL(url);
			//var con = (HttpsURLConnection) obj.openConnection();
			HttpURLConnection con = (HttpURLConnection) obj.openConnection();
			con.setDoOutput(true);

			//add auth
			String userpass = (String)eventData.get( "accountSid" ) + ":" + (String)eventData.get( "accountKey" );
			System.out.println("USER:PASS : " + userpass);
			String basicAuth = "Basic " + new String(java.util.Base64.getEncoder().encodeToString(userpass.getBytes()));
			System.out.println("AUTH : " + basicAuth);
			con.setRequestProperty("Authorization", basicAuth);

			//add reuqest header
			con.setRequestMethod("POST");
			String urlParameters = "Url=http://demo.twilio.com/docs/voice.xml&To=%2B" + (String)eventData.get( "to" ) + "&From=%2B" + (String)eventData.get( "from" );

			DataOutputStream wr = new java.io.DataOutputStream(con.getOutputStream());
			wr.writeBytes(urlParameters);
			wr.flush();
			wr.close();

			int responseCode = con.getResponseCode();
			System.out.println("\nSending 'POST' request to URL : " + url);
			System.out.println("Post parameters : " + urlParameters);
			System.out.println("Response Code : " + responseCode);

			return "SUCCESS";
		}
		catch( Exception e )  {
			e.printStackTrace();
			System.out.println( "FAILED : " + e.getMessage() );
			return "FAILURE";
		}
	}
}

