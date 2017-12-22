package com.galacticfog;

import com.sun.management.OperatingSystemMXBean;
import org.joda.time.DateTime;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.management.ManagementFactory;

public class LoadTester {

  StringBuilder outString = new StringBuilder();
  Logger log = LoggerFactory.getLogger( this.getClass() );

  public void log( String thing ) {
    outString.append( thing );
    log.debug( thing );
  }

  public static final OperatingSystemMXBean OPERATING_SYSTEM_MX_BEAN = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

  public String getLog() {
    return outString.toString();
  }

  public String load( String payload, String context ) throws Exception {

    JSONParser parser = new JSONParser();
    JSONObject eventData = (JSONObject)parser.parse( payload );

    log( "**** TESTING MY LOG SYSTEM ***" );

    float loadAmt = Float.valueOf((String)eventData.getOrDefault("load", "0.5")).floatValue();
    int runTimeSecs = Integer.valueOf((String)eventData.getOrDefault( "runtime", "30")).intValue();
    int numThreads = Integer.valueOf((String)eventData.getOrDefault( "threads", "1")).intValue();

    Load load = Load.getInstance();
    load.setLoad( loadAmt );
    load.setNumThreads( numThreads );
    load.start();

    boolean running = true;
    DateTime started = DateTime.now();
    while( running ) {
      Thread.sleep( 1000 );

      NodeStatus status = load.getStatus();
      LoadEntity le = status.getLoad();

      log.debug( "avail cpus   : " + OPERATING_SYSTEM_MX_BEAN.getAvailableProcessors() );
      log.debug( "system load  : " + le.getSystemLoad() );
      log.debug( "process load : " + le.getProcessLoad() );
      log.debug( "applied load : " + le.getProcessLoadApplied() );


      if( DateTime.now().isAfter( started.plusSeconds( runTimeSecs ))) {
        running = false;
      }
    }

    return "Done";
  }
}
