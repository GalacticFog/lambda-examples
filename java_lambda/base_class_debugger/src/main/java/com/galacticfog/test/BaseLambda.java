package com.galacticfog.test;

public abstract class BaseLambda {

  public String hi( String payload, String context ) {
    return hello( payload, context );
  }

  abstract String hello( String payload, String context );
}