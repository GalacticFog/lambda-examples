function migrate(event, creds) {
    //console.log("migrate.event : " + event );
    //console.log("migrate.creds : " + creds );
    var event = JSON.parse( event );
    var eventContext = event.eventContext;
    var lambdaArgs = event.lambdaArgs;
    var meta = "https://meta.aqr.galacticfog.com"
    var oid = eventContext.org;
    var eid = eventContext.environment;
    var container = lambdaArgs.resource;
    var providerId = lambdaArgs.providerId;
    if ( ! providerId ) {
        console.log("no provider id specified; migration will fail");
        return "FAILURE; must specify providerId"
    }

    // need fqon, get from oid
    var getUrl = meta + '/orgs/' + oid;
    console.log("\nGET : " + getUrl);
    var getCon = new java.net.URL(getUrl).openConnection();
    getCon.setRequestProperty("Authorization", creds);
    getCon.setRequestMethod("GET");
    var getRespCode = getCon.getResponseCode();
    console.log("Response Code : " + getRespCode);
    if (getRespCode != 200) return "FAILED";
    var iStream = getCon.getContent();
    var br = new java.io.BufferedReader(new java.io.InputStreamReader(iStream, "utf8"));
    var sb = new java.lang.StringBuffer();
    var line = "";
    while ((line = br.readLine()) != null) {
        sb.append(line);
    }
    var orgStr = sb.toString();
    //console.log(orgStr);
    var org = JSON.parse(orgStr);
    var fqon = org.properties.fqon;
    console.log("FOUND ORG : " + fqon);

    var op = container.properties;
    var ni = JSON.parse(op.num_instances);
    var newContainer = {
        name: container.name,
        description: container.description,
        properties: {
            provider: {
                id: providerId
            },
            num_instances: ni > 0 ? ni : 1,
            cpus: JSON.parse(op.cpus),
            memory: JSON.parse(op.memory),
            container_type: op.container_type,
            image: op.image,
            network: op.network,
            health_checks: op.health_checks ? JSON.parse(op.health_checks) : [],
            port_mappings: op.port_mappings  ? JSON.parse(op.port_mappings) : [],
            labels: op.labels ? JSON.parse(op.labels) : {},
            env: op.env ? JSON.parse(op.env) : {},
            volumes : op.volumes ? JSON.parse(op.volumes) : [],
            force_pull : op.force_pull ? JSON.parse(op.force_pull) : false,
            args : op.args ? JSON.parse(op.args) : [],
            cmd: op.cmd,
            user: op.user
        }
    };
    var createUrl = meta + '/' + fqon + '/environments/' + eid + '/containers';
    console.log("\nSending 'POST' request to URL : " + createUrl);
    var createCon = new java.net.URL(createUrl).openConnection();
    createCon.setDoOutput( true );
    createCon.setRequestProperty("Authorization", creds);
    createCon.setRequestProperty("Content-Type", "application/json");
    createCon.setRequestMethod("POST");
    var wr = new java.io.DataOutputStream(createCon.getOutputStream());
    wr.writeBytes(JSON.stringify(newContainer));
    wr.flush();
    wr.close();
    var createRespCode = createCon.getResponseCode();
    console.log("Response Code : " + createRespCode);

    if (createRespCode == 201) {
        var deleteUrl = meta + '/' + fqon + '/environments/' + eid + '/containers/' + eventContext.resourceId;
        console.log("\nSending 'DELETE' request to URL : " + deleteUrl);
        var deleteCon = new java.net.URL(deleteUrl).openConnection();
        deleteCon.setRequestProperty("Authorization", creds);
        deleteCon.setRequestMethod("DELETE");
        var deleteRespCode = deleteCon.getResponseCode();
        console.log("Response Code : " + deleteRespCode);
        return "SUCCESS";
    } else {
        console.warn("FAILURE; did not receive 201; will not delete old container")
    }
}
