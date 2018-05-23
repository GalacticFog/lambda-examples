package com.galacticfog

import java.io.File
import java.net.URLDecoder
import java.nio.charset.Charset
import java.util
import java.util.{Properties, UUID}
import java.util.concurrent.TimeUnit

import org.apache.kafka.clients.consumer.{ConsumerRecord, ConsumerRecords, KafkaConsumer}
import org.apache.kafka.clients.producer.{KafkaProducer, ProducerRecord}
import org.apache.kafka.common.TopicPartition
import org.joda.time.DateTime
import org.json.simple.parser.JSONParser
import org.json.simple.{JSONArray, JSONObject}
import org.slf4j.LoggerFactory

import scala.collection.JavaConverters._
import scala.collection.mutable.ArrayBuffer
import scala.util.Random
import collection.JavaConverters._
import scala.collection.mutable


class LambdaConsumer {

  val log = LoggerFactory.getLogger( getClass )

  log.debug( "**** STARTING CONSUMER *****")

  val topic = sys.env.getOrElse( "KAFKA_TOPIC", "sanity1" )
  val brokers = sys.env.getOrElse( "KAFKA_BROKERS", "localhost:9092" )
  val groupId = sys.env.getOrElse( "GROUP_ID", UUID.randomUUID().toString )
  val defaultMaxResults = sys.env.getOrElse( "DEFAULT_MAX_RESULTS", "100" ).toInt
  val maxTimeSeconds = sys.env.getOrElse( "MAX_TIME_SECONDS", "5" ).toInt

  val rnd = new Random()
  val props = new Properties()

  log.debug( "using brokers : " + brokers )
  props.put("bootstrap.servers", brokers)
  //props.put("client.id", "ScalaConsumerTester")
  props.put("group.id", groupId )

  props.put("enable.auto.commit", "true")
  props.put("auto.commit.interval.ms", "1000")
  props.put("consumer.timeout.ms", "1000")

  // This only applies if there's not a group offset stored for this groupId.  It tells the consumer for fresh offset
  // scenario, how to startup.  "latest" says skip everything before now.  "earliest" says show me everything you know about
  // The important note is that it's only for groups that don't already have a stored offset.  There are other ways
  // to skip to the end of a known offset using the "seek" capabilities
  props.put("auto.offset.reset", "earliest")

  //TODO : change this once we're running and not concerned with this causing the poll hang
  props.put("max.poll.records", "1000")

  props.put("session.timeout.ms", "30000")
  props.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer")
  //props.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer")
  props.put("value.deserializer", "org.apache.kafka.common.serialization.ByteArrayDeserializer")

  val consumer = new KafkaConsumer[String, Array[Byte]](props)

  def init(): Unit = {
    log.debug( "lambda init()" )
  }

  def destroy() {
    log.debug( "lambda destroy()" )
    consumer.close()
  }

  def consume( stringEvent : String, stringContext : String ) : String = {

    val startTime = DateTime.now()
    val parser = new JSONParser()
    val context = parser.parse( stringContext ).asInstanceOf[JSONObject]
    log.debug( "context : " + context.toJSONString )

    val params = context.get( "params" ).asInstanceOf[JSONObject]
    log.debug( "queryParams : " + params.toJSONString )

    val resultEntry = params.get( "numResults" )
    val numResults = if ( resultEntry != null ) resultEntry.asInstanceOf[JSONArray].get(0).asInstanceOf[String].toInt else defaultMaxResults

    //TODO : fix this, it's broken with the extraction of the values from the params
    val offsets = if( params.containsKey( "offsets" ) )
    {
      val offsetString = params.get( "offsets" ).asInstanceOf[String]
      log.debug( s"offset string (encoded) : ${offsetString}" )
      val offsetsDecoded = URLDecoder.decode( offsetString, "UTF-8" )
      log.debug( s"offset string (decoded) : ${offsetsDecoded}" )
      val jsonOffsets = parser.parse( offsetsDecoded ).asInstanceOf[JSONObject]

      jsonOffsets.asInstanceOf[util.Map[String,Long]].asScala.map{ entry =>
        log.debug( s"offset : ${entry._1} -> ${entry._2}" )
        (entry._1.asInstanceOf[String].toInt -> entry._2.asInstanceOf[Long])
      }
    }
    else
    {
      val startOffset = params.get( "startOffset")
      if( startOffset != null )
      {
        log.debug( s"start offset specified : ${startOffset.asInstanceOf[JSONArray].get(0)}" )
        val offset = startOffset.asInstanceOf[JSONArray].get(0).asInstanceOf[String].toLong
        mutable.Map[Int,Long]( 0 -> offset )
      } else
      {
        log.debug( "no starting offset, rewinding from latest" )
        val ends = consumer.endOffsets( Seq(new TopicPartition(topic, 0)).asJavaCollection ).asScala
        ends.keys.map{ key =>
          val offset = ends.get(key).get
          val rewoundOffset = Math.max( (offset - numResults), 0 )

          log.debug( s"latest offset ${offset} -> rewoundOffset ${rewoundOffset}" )

          ( key.partition() -> rewoundOffset )
        }.toMap
      }
    }

    if( offsets.nonEmpty )
    {
      log.debug( "found offsets, using OffsetHandler..." )
      val offsetHandler = new OffsetConsumer( consumer, offsets.map{ entry => new Integer( entry._1 ) -> new java.lang.Long(entry._2) }.asJava )

      val tps = offsets.map{ off =>
        new TopicPartition( topic, off._1 )
      }

      //TODO : does this take time to complete?
      consumer.assign( tps.asJavaCollection )

      offsets.foreach{ entry =>
        log.debug( s"seeking partition ${entry._1} to ${entry._2}" )
        val tp = new TopicPartition( topic, entry._1)
        consumer.seek( new TopicPartition( topic, entry._1), entry._2 )
      }
    }
    else
    {
      log.debug( "no offsets, subscribe simply..." )
      consumer.subscribe(util.Arrays.asList(topic))
    }

    var output : String = null
    var taken : Int = 0
    var allRecords = mutable.ListBuffer[ConsumerRecord[String,Array[Byte]]]()

    try {

      log.debug(s"beginning loop results(${numResults}) timeleft(${(maxTimeSeconds - ((DateTime.now.getMillis - startTime.getMillis)/1000.0f ))}....")
      //log.debug( s"is ${startTime.toLocalDateTime.toString} + ${maxTimeSeconds} before ${DateTime.now.toLocalDateTime.toString}? : ${startTime.plusSeconds( maxTimeSeconds ).isBeforeNow}" )

      while ( taken < numResults && (startTime.plusSeconds( maxTimeSeconds ).isAfterNow ) ) {
        log.debug("pre-poll...")

        val pos = consumer.position( new TopicPartition( topic, 0) )
        log.debug( s"position (0) : ${pos} " )

        val records = consumer.poll(1000).asScala
        log.debug(s"post-poll...(${records.size})")
        taken += records.size

        allRecords = allRecords ++= records
      }

      val results = allRecords.take( numResults ).map{ record =>

        log.debug(record.offset() + " - record.key : " + record.key() + " - record.value : " + record.value)
        val outMap = mutable.Map(
          "topic" -> record.topic(),
          "partition" -> record.partition(),
          "offset" -> record.offset(),
          "key" -> record.key(),
          "value" -> record.value()
        )
        new JSONObject( outMap.asJava )
      }

      val list = results.asJava

      output = JSONArray.toJSONString( list )
    } catch {
      case ex: Exception => {
        ex.printStackTrace
        output = JSONArray.toJSONString( List().asJava )
      }
    } finally {

      // We can't close it here because it'll ruin subsequent executions
      //consumer.close()
    }

    output
  }
}

