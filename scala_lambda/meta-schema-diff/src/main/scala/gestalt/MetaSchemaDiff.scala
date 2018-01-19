package gestalt

import java.util.UUID

import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import play.api.Logger
import play.api.libs.json.{JsObject, JsValue, Json}
import play.api.libs.ws.{WS, WSAuthScheme, WSClient, WSRequest}
import play.api.libs.ws.ahc.AhcWSClient

import scala.collection.immutable.Range
import scala.collection.mutable
import scala.util.{Failure, Success, Try}
import scala.concurrent.Await
import scala.concurrent.duration._

class MetaSchemaDiff {

  val logger = Logger(this.getClass)

  val baseMetaUrl = getEnv("META_URL")
  val apiKey      = getEnv("API_KEY")
  val apiSecret   = getEnv("API_SECRET")
  val targetFqon      = getEnv("TARGET_FQON")
  val targetWorkspace = getEnv("TARGET_WORKSPACE")
  val targetProvider  = getEnv("TARGET_PROVIDER")
  val securityDockerImage = getEnv("SECURITY_IMAGE", Some("galacticfog/gestalt-security:release-1.5.0"))
  val testMetaUrl         = getEnv("TEST_META_URL", Some(baseMetaUrl))
  val testMetaApiKey      = getEnv("TEST_API_KEY", Some(apiKey))
  val testMetaApiSec      = getEnv("TEST_API_SECRET", Some(apiSecret))
  val slackUrl            = getEnv("SLACK_URL")

  implicit val system = ActorSystem()
  implicit val materializer = ActorMaterializer()
  val ws: WSClient = AhcWSClient()

  def log(m: String) = logger.info(m)

  private[this] implicit def baseMetaRequestBuilder(endpoint: String) = ws.url(baseMetaUrl + "/" + endpoint.stripPrefix("/")).withAuth(apiKey, apiSecret, WSAuthScheme.BASIC)

  private[this] def testMeta(endpoint: String) = ws.url(baseMetaUrl + "/" + endpoint.stripPrefix("/")).withAuth(apiKey, apiSecret, WSAuthScheme.BASIC)

  private[this] def rawRequestBuilder(url: String): WSRequest = ws.url(url)

  def diff(payloadStr: String, ctxStr: String): String = {
    val payload = Try{Json.parse(payloadStr)} getOrElse Json.obj()
    log(s"parsed payload is: '${payload}'")
    val ctx = Json.parse(ctxStr)
    log(s"parsed context is: '${ctx}'")

    val workspace = REST(s"/${targetFqon}/workspaces").get.as[Seq[JsObject]].find(js => (js \ "name").as[String] == targetWorkspace) getOrElse {throw new RuntimeException(s"could not find target workspace: ${targetWorkspace}")}
    val workspaceId = (workspace \ "id").as[String]

    log("creating test environment")
    val testEnvIdTry = REST(s"/${targetFqon}/workspaces/${workspaceId}/environments", "POST", Some(Json.obj(
      "name" -> UUID.randomUUID().toString.substring(0,7),
      "properties" -> Json.obj(
        "environment_type" -> "test"
      )
    ))) flatMap {js => Try{(js \ "id").as[String]}}

    val diff = Try {

      val Success(goldMeta) = for {
        testEnvId <- testEnvIdTry
        _ = log(s"created test environment ${testEnvId}")
        aboutMeta <- REST("/about")
        metaDockerImage <- Try {
          (aboutMeta \ "docker_image").as[String]
        }
        //// Create containers first
        // database
        dbContainer <- {
          log("creating postgres container")
          REST(s"/$targetFqon/environments/$testEnvId/containers", "POST", Some(dbContainer))
        }
        dbContainerAddress <- Try {
          (dbContainer \ "properties" \ "port_mappings" \ (0) \ "service_address" \ "host").as[String]
        }
        // security
        securityContainer <- {
          log("creating security container")
          REST(s"/$targetFqon/environments/$testEnvId/containers", "POST", Some(securityContainer(dbContainerAddress)))
        }
        testSecurityAddress <- Try {
          (securityContainer \ "properties" \ "port_mappings" \ (0) \ "service_address" \ "host").as[String]
        }
        // meta
        metaContainer <- {
          log("creating meta container")
          REST(s"/$targetFqon/environments/$testEnvId/containers", "POST", Some(metaContainer(testSecurityAddress, dbContainerAddress, metaDockerImage)))
        }
        goldMetaAddress <- Try {
          (metaContainer \ "properties" \ "port_mappings" \ (0) \ "service_address" \ "host").as[String]
        }
        //// init security
        _ <- {
          Stream.range(1, 60).map({ i =>
            Thread.sleep(1000)
            log(s"Attempt $i to check security /init")
            val ready = REST(s"http://$testSecurityAddress:9455/init")(rawRequestBuilder)
            log(ready.toString)
            ready.flatMap(js => Try {
              (js \ "initialized").as[Boolean]
            })
          }).collectFirst({ case s@Success(isInit) => isInit }) match {
            case Some(false) => Success("security is ready for /init")
            case Some(true) => Failure(new RuntimeException("security has somehow already been initialized"))
            case None => Failure(new RuntimeException("security is not ready to be initialized yet"))
          }
        }
        initSecurity <- REST(s"http://$testSecurityAddress:9455/init", "POST", Some(Json.obj(
          "username" -> "admin",
          "password" -> "admin"
        )))(rawRequestBuilder)
        testApiKey <- Try {
          (initSecurity \ (0) \ "apiKey").as[String]
        }
        testApiSecret <- Try {
          (initSecurity \ (0) \ "apiSecret").as[String]
        }
        _ = log(s"security credentials: $testApiKey:$testApiSecret")
        //// bootstrap meta
        goldMetaUrl = s"http://$goldMetaAddress:14374"
        goldMeta = (endpoint: String) => ws.url(goldMetaUrl + "/" + endpoint.stripPrefix("/")).withAuth(testApiKey, testApiSecret, WSAuthScheme.BASIC)
      } yield goldMeta

      val Success(_) = for {
        ready <- {
          Stream.range(1, 60).map({ i =>
            Thread.sleep(1000)
            log(s"Attempt $i to check meta /about")
            val ready = REST("/about")(goldMeta)
            log(ready.toString)
            ready.flatMap(js => Try {
              (js \ "status").as[String]
            })
          }).collectFirst({ case s@Success(status) => status }) match {
            case Some("OK") => Success("meta is ready for /bootstrap")
            case Some(_) => Failure(new RuntimeException("meta is up but not ready for /bootstrap"))
            case None => Failure(new RuntimeException("meta is apparently not up yet"))
          }
        }
        _ = log(s"$ready")
        _ = log("bootstrapping meta")
        bootstrap <- REST("/bootstrap", "POST", None, timeout = 30)(goldMeta)
        _ = log(bootstrap.toString)
      } yield ()

      val failures = mutable.MutableList[String]()

      val testRTs = REST("/root/resourcetypes")(testMeta)
        .flatMap(js => Try{js.as[Seq[ResourceLink]]})
        .getOrElse(throw new RuntimeException("could not retrieve schema from test meta"))
        .map(rt => (rt.id,rt.name)).toSet
      val goldRTs = REST("/root/resourcetypes")(goldMeta)
        .flatMap(js => Try{js.as[Seq[ResourceLink]]})
        .getOrElse(throw new RuntimeException("could not retrieve schema from gold meta"))
        .map(rt => (rt.id,rt.name)).toSet
      val missing = goldRTs.diff(testRTs)
      missing.foreach {
        case (id,name) =>
          val msg = s"missing ResourceType $name"
          log(msg)
          failures += msg
      }

      failures
    }

    val slackMsg = diff match {
      case Success(failures) =>
        Json.obj(
          "username" -> "meta-schema-diff-lambda",
          "attachments" -> Seq(Json.obj(
            "color" -> (if (failures.isEmpty) "#00ff00" else "#ff0000"),
            "pretext" -> s"Diff result against $testMetaUrl",
            "text" -> (if (failures.isEmpty) "success :100:" else failures.mkString("\n"))
          ))
        )
      case Failure(err) =>
        Json.obj(
          "username" -> "meta-schema-diff-lambda",
          "attachments" -> Seq(Json.obj(
            "color" -> "#ff0000",
            "pretext" -> s"Error during lambda",
            "text" -> err.toString
          ))
        )
    }
    REST(slackUrl, "POST", Some(slackMsg))(rawRequestBuilder) match {
      case Success(_) => log("posted message to slack")
      case Failure(err) => log(s"error posting message to slack:\n${err.toString}")
    }

    log("cleaning up by deleting test environment")
    testEnvIdTry foreach {
      envId =>
        val delete = REST(s"/${targetFqon}/environments/${envId}?force=true", "DELETE", None, timeout = 10)
        log(s"deleted environment ${envId}: ${delete.toString}")
    }

    "done"
  }

  private[this] def getEnv(name: String, default: Option[String] = None): String = {
    sys.env.get(name) orElse default getOrElse {throw new RuntimeException(s"could not location environment variable '${name}'")}
  }

  private[this] def REST(endpoint: String, method: String = "GET", payload: Option[JsValue] = None, timeout: Int = 5)
                        (implicit requestBuilder: (String => WSRequest)): Try[JsValue] = {
    val fr = payload.foldLeft(
      requestBuilder(endpoint)
    )({case (r,b) => r.withBody(b)}).execute(method)
    for {
      resp <- Try{Await.result(fr, timeout seconds)}
      ret <- resp.status match {
        case 204 => Success(Json.obj())
        case ok if 200 <= ok && ok <= 299 => Success(resp.json)
        case _ => Failure(
          new RuntimeException(Try{ (resp.json \ "message").as[String] } getOrElse resp.body)
        )
      }
    } yield ret
  }

  private[this] def metaContainer(testSecurityAddress: String, dbContainerAddress: String, metaDockerImage: String): JsObject = Json.obj(
    "name" -> "meta",
    "properties" -> Json.obj(
      "container_type" -> "DOCKER",
      "cpus" -> 1,
      "env" -> Json.obj(
        "GESTALT_SECURITY_HOSTNAME" -> testSecurityAddress,
        "GESTALT_SECURITY_PROTOCOL" -> "http",
        "GESTALT_SECURITY_PORT" -> "9455",
        "DATABASE_HOSTNAME" -> dbContainerAddress,
        "DATABASE_PORT" -> "5432",
        "DATABASE_NAME" -> "gestalt-meta",
        "DATABASE_PASSWORD" -> "gestaltdev",
        "DATABASE_USERNAME" -> "gestaltdev",
        "RABBIT_HTTP_PORT" -> "15672",
        "RABBIT_HOST" -> "dummy-rabbit",
        "RABBIT_PORT" -> "5672",
        "RABBIT_ROUTE" -> "dummy-rabbit-route",
        "RABBIT_EXCHANGE" -> "dummy-rabbit-exchange"
      ),
      "force_pull" -> true,
      "image" -> metaDockerImage,
      "memory" -> 2048,
      "network" -> "BRIDGE",
      "num_instances" -> 1,
      "port_mappings" -> Seq(Json.obj(
        "container_port" -> 9000,
        "expose_endpoint" -> true,
        "name" -> "meta",
        "protocol" -> "tcp",
        "service_port" -> 14374
      )),
      "provider" -> Json.obj(
        "id" -> targetProvider
      )
    )
  )

  private[this] def securityContainer(dbContainerAddress: String): JsObject = Json.obj(
    "name" -> "security",
    "properties" -> Json.obj(
      "container_type" -> "DOCKER",
      "cpus" -> 1,
      "env" -> Json.obj(
        "DATABASE_HOSTNAME" -> dbContainerAddress,
        "DATABASE_PORT" -> "5432",
        "DATABASE_NAME" -> "gestalt-security",
        "DATABASE_PASSWORD" -> "gestaltdev",
        "DATABASE_USERNAME" -> "gestaltdev"
      ),
      "force_pull" -> true,
      "image" -> securityDockerImage,
      "memory" -> 2048,
      "network" -> "BRIDGE",
      "num_instances" -> 1,
      "port_mappings" -> Seq(Json.obj(
        "container_port" -> 9000,
        "expose_endpoint" -> true,
        "name" -> "security",
        "protocol" -> "tcp",
        "service_port" -> 9455
      )),
      "provider" -> Json.obj(
        "id" -> targetProvider
      )
    )
  )

  private[this] def dbContainer: JsObject = Json.obj(
    "name" -> "postgres",
    "properties" -> Json.obj(
      "container_type" -> "DOCKER",
      "cpus" -> 1,
      "env" -> Json.obj(
        "POSTGRES_PASSWORD" -> "gestaltdev",
        "POSTGRES_USER" -> "gestaltdev"
      ),
      "force_pull" -> true,
      "image" -> "galacticfog/gestalt-data:release-1.2.0",
      "memory" -> 1024,
      "network" -> "BRIDGE",
      "num_instances" -> 1,
      "port_mappings" -> Seq(Json.obj(
        "container_port" -> 5432,
        "expose_endpoint" -> true,
        "name" -> "sql",
        "protocol" -> "tcp",
        "service_port" -> 5432
      )),
      "provider" -> Json.obj(
        "id" -> targetProvider
      )
    )
  )

  case class ResourceLink( id: UUID, name: String )

  case class LineageInfo( child_types: Seq[UUID], parent_types: Seq[UUID] )

  case class ActionInfo( prefix: String, verbs: Seq[String] )

  case class ResourceType( id: UUID,
                           name: String,
                           `abstract`: Option[Boolean],
                           actions: Option[ActionInfo],
                           lineage: Option[LineageInfo],
                           property_defs: Seq[ResourceLink] )

  implicit val resourceLinkFmt = Json.format[ResourceLink]
  implicit val lineageInfoFmt = Json.format[LineageInfo]
  implicit val actionInfoFmt = Json.format[ActionInfo]
  implicit val resourceTypeFmt = Json.format[ResourceType]

}
