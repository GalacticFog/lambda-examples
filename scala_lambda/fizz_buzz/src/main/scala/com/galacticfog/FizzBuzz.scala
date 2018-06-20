package com.galacticfog

import java.util.Base64

import org.json.simple.parser.JSONParser
import org.json.simple.JSONObject
import org.slf4j.LoggerFactory

class FizzBuzz {

  val log = LoggerFactory.getLogger( getClass )
  var parser = new JSONParser()

  log.debug( "**** STARTING FIZZBUZZ *****")

  def init(): Unit = {
    log.debug( "lambda init()" )
  }

  def destroy() {
    log.debug( "lambda destroy()" )
  }

  def fizz( stringEvent : String, stringContext : String ) : String = {

    //
    // first parse the event json
    //

    log.debug(s"event : ${stringEvent}")
    val event = parser.parse( stringEvent ).asInstanceOf[JSONObject]

    //
    // now fetch the value and decode it
    //

    val kafkaVal = event.get( "value" ).asInstanceOf[String]
    val jsonVal = new String( Base64.getDecoder.decode( kafkaVal ) )

    //
    // now the business logic.  do whatever you like with the event data that you are expecting.
    // in this case we expect a json payload with a integer called "index"
    //

    val msg = parser.parse( jsonVal ).asInstanceOf[JSONObject]
    val number = msg.get( "index" ).asInstanceOf[Long].toInt
    log.debug( s"index : ${number}" )

    //
    // now do fizzbuzz
    //

    val out = number match {
      case n : Int if ( n == 0 ) => n.toString
      case n : Int if ( (n % 5 == 0) && (n % 3 == 0))  => {
        "fizzbuzz"
      }
      case n : Int if (n % 3 == 0) => {
        "fizz"
      }
      case n : Int if (number % 5 == 0) => {
        "buzz"
      }
      case dunno => dunno.toString
    }

    //
    // output is String
    //

    log.debug( s"in : ${number} -> out : ${out}" )
    out
  }
}

