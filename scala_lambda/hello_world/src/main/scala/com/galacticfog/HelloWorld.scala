package com.galacticfog

import org.slf4j.LoggerFactory

class HelloWorld {

  val log = LoggerFactory.getLogger( this.getClass )

  log.info( "lambda static init")

  def init(): Unit = {
    log.info( "lambda init()" )
  }

  def destroy() {
    log.info( "lambda destroy()" )
  }

  def hello( stringEvent : String, stringContext : String ) : String = {
    log.info( "lambda hello()")
    "Hello, world!"
  }
}

