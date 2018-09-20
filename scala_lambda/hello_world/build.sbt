import sbtassembly.MergeStrategy
import Dependencies._

name := "hello-world"

isSnapshot        := true

publishMavenStyle := true

lazy val root = project in file(".")

libraryDependencies += "org.slf4j" % "slf4j-simple" % "1.7.21"

credentials       += Credentials( 
    "Artifactory Realm",
    "galacticfog.artifactoryonline.com",
    sys.env.getOrElse("GF_ARTIFACTORY_USER","MISSING_USERNAME"),
    sys.env.getOrElse("GF_ARTIFACTORY_PWD","MISSING_PASSWORD") 
)

assemblyMergeStrategy in assembly := {
  case x if Assembly.isConfigFile(x) => reverseConcat
  case other  => MergeStrategy.defaultMergeStrategy(other)
}

artifact in (Compile, assembly) ~= { art =>
  art.copy(`classifier` = Some("assembly"))
}

addArtifact(artifact in (Compile, assembly), assembly)

val reverseConcat: MergeStrategy = new MergeStrategy {
  val name = "reverseConcat"
  def apply(tempDir: File, path: String, files: Seq[File]): Either[String, Seq[(File, String)]] =
    MergeStrategy.concat(tempDir, path, files.reverse)
}

resolvers in ThisBuild ++= Seq(
  "gestalt-snapshots" at "https://galacticfog.artifactoryonline.com/galacticfog/libs-snapshots-local",
  "gestalt-releases" at "https://galacticfog.artifactoryonline.com/galacticfog/libs-releases-local"
)

publishTo in ThisBuild <<= version { (v: String) =>
  val ao = "https://galacticfog.artifactoryonline.com/galacticfog/"
  if (v.trim.endsWith("SNAPSHOT"))
    Some("publish-gf-snapshots" at ao + "libs-snapshots-local;build.timestamp=" + new java.util.Date().getTime)
  else
    Some("publish-gf-releases"  at ao + "libs-releases-local")
}

scalaVersion in ThisBuild := "2.11.7"

organization in ThisBuild := "com.galacticfog"

version      in ThisBuild := "0.1"
