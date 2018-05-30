package com.galacticfog

import java.io.File
import java.net.URLDecoder
import java.nio.charset.Charset
import java.util
import java.util.{Properties, UUID}
import java.util.concurrent.TimeUnit

import org.apache.kafka.clients.consumer.{ConsumerRecord, ConsumerRecords, KafkaConsumer}
import org.apache.kafka.clients.producer.{Callback, KafkaProducer, ProducerRecord, RecordMetadata}
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


class Producer {

  val log = LoggerFactory.getLogger( getClass )

  log.debug( "**** STARTING PRODUCER *****")

  val topic = sys.env.getOrElse( "KAFKA_TOPIC", "sanity1" )
  val brokers = sys.env.getOrElse( "KAFKA_BROKERS", "localhost:9092" )
  val defaultMaxResults = sys.env.getOrElse( "DEFAULT_MAX_RESULTS", "100" ).toInt
  val maxTimeSeconds = sys.env.getOrElse( "MAX_TIME_SECONDS", "5" ).toInt

  val rnd = new Random()
  val props = new Properties()

  log.debug( "using brokers : " + brokers )
  props.put("bootstrap.servers", brokers)


  props.put("client.id", "ScalaProducerTester")
  props.put("acks", "all")

  props.put("retries", "0" )
  props.put("batch.size", "16384" )
  props.put("linger.ms", "1" )

  props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer")
  props.put("value.serializer", "org.apache.kafka.common.serialization.ByteArraySerializer")

  val producer = new KafkaProducer[String, Array[Byte]](props)

  def init(): Unit = {
    log.debug( "lambda init()" )
  }

  def destroy() {
    log.debug( "lambda destroy()" )
    producer.close()
  }

  def produce( stringEvent : String, stringContext : String ) : String = {

    val startTime = DateTime.now()
    val parser = new JSONParser()
    val context = parser.parse( stringContext ).asInstanceOf[JSONObject]
    log.debug( "context : " + context.toJSONString )

    val params = context.get( "params" ).asInstanceOf[JSONObject]
    log.debug( "queryParams : " + params.toJSONString )

    val resultEntry = params.get( "numResults" )
    val numResults = if ( resultEntry != null ) resultEntry.asInstanceOf[JSONArray].get(0).asInstanceOf[String].toInt else defaultMaxResults


    log.debug( "particions for topic : " + topic )
    producer.partitionsFor( topic ).asScala.foreach{ part => log.debug( "partInfo : " + part.toString )}

    log.debug( "bout to start looping ... " )
    for ( count <- Range(0, numResults)) {

      val out = s"""{ "index" : ${count} }"""
      val serializedBytes: Array[Byte] = out.getBytes

      log.debug("Sending message : " + out + " in bytes : " + serializedBytes)
      val message = new ProducerRecord[String, Array[Byte]](topic, "test-key", serializedBytes)

      producer.send(message, new Callback {
        override def onCompletion( m : RecordMetadata, e : Exception): Unit = {
          if(e != null) {
            e.printStackTrace()
          } else {
            log.debug( "topic : " + m.topic() + " - offset : " + m.offset() )
          }
        }
      })
    }

    s"published ${numResults} to ${topic}. bye."
  }
}

