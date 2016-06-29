using System;
using System.Collections.Generic;
using System.Text;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

public class Program
{
	public static void Main (string[] args)
	{

		try {
			var client = new HttpClient();
			var eventString = args[0];

			Console.WriteLine( "EVENT : " + eventString );

			dynamic eventData = JsonConvert.DeserializeObject( eventString );
			dynamic data = JsonConvert.DeserializeObject( eventData.data.ToString() );

			var account 		= data.accountSid != null ? data.accountSid.ToString()  : "";
			var secret 			= data.accountKey != null ? data.accountKey.ToString()  : "";
			var from 				= data.from != null ? data.from.ToString()  : "";
			var to 					= data.to != null ? data.to.ToString()  : "";
			var greetingUrl	= data.url != null ? data.url.ToString()  : "";

			var config = new ConfigurationBuilder()
			    .AddEnvironmentVariables()
					.Build();

			Console.WriteLine( "VARS : " );
			foreach(var envVar in config.GetChildren())
			{
				Console.WriteLine($"{envVar.Key}: {envVar.Value}");
			}

			account 				= orElse( config["CALL_ACCOUNT"] , account );
			secret 					= orElse( config["CALL_SECRET"], secret );
			from 						= orElse( config["CALL_FROM"], from );
			to 							= orElse( config["CALL_TO"], to );
			greetingUrl			= orElse( config["CALL_URL"], greetingUrl );

			Console.WriteLine( "ACCOUNT : " + account );
			Console.WriteLine( "FROM : " + from );
			Console.WriteLine( "TO : " + to );
			Console.WriteLine( "URL : " + greetingUrl );

			var credentials = account + ":" + secret;

			// Create the HttpContent for the form to be posted.
			var requestContent = new FormUrlEncodedContent(new [] {
					new KeyValuePair<string, string>("From", from ),
					new KeyValuePair<string, string>("To", to ),
					new KeyValuePair<string, string>("Url", greetingUrl )
					});

			//requestContent.Headers.Add("Authorization", "Basic " + Convert.ToBase64String(Encoding.ASCII.GetBytes((string)credentials)) );
			client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.ASCII.GetBytes((string)credentials)) );

			var url = "https://api.twilio.com/2010-04-01/Accounts/" + (string)account + "/Calls.json";

			// Get the response.
			Task<HttpResponseMessage> task = client.PostAsync( url, requestContent );
			task.Wait();
			HttpResponseMessage response = task.Result;


			// Get the response content.
			HttpContent responseContent = response.Content;

			// Get the stream of the content.
			Task<Stream> streamTask = responseContent.ReadAsStreamAsync();
			streamTask.Wait();
			using (var reader = new StreamReader(streamTask.Result))
			{
				// Write the output.
				Task<string> readTask = reader.ReadToEndAsync();
				readTask.Wait();
				Console.WriteLine( readTask.Result );
			}
		}
		catch( Exception e ) {
			Console.WriteLine("An exception ({0}) occurred.", e.GetType().Name);
			Console.WriteLine("   Message:\n{0}", e.Message);
			Console.WriteLine("   Stack Trace:\n   {0}", e.StackTrace);
		}
	}

	private static string orElse( string thing, string otherThing ) 
	{
		return ( thing != null ) ? thing : otherThing;
	}
}
