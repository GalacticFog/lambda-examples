function migrate(args, creds) {
    console.log("migrate.args : " + args );
    console.log("migrate.creds : " + creds );
    var args = JSON.parse( args );
    var meta = args.meta_url;
    var pid  = args.provider_id;
    var fqon = args.fqon;
    var eid  = args.environment_id;
    var container = args.resource;
    if ( ! pid ) {
        console.log("no provider id specified; migration will fail");
        return "FAILURE; must specify providerId"
    }

    var op = container.properties;
    var ni = JSON.parse(op.num_instances);
    var newContainer = {
        name: container.name,
        description: container.description,
        properties: {
            provider: {
                id: pid
            },
            num_instances: ni > 0 ? ni : 1,
            cpus: op.cpus,
            memory: op.memory,
            container_type: op.container_type,
            image: op.image,
            network: op.network,
            health_checks: op.health_checks ? op.health_checks : [],
            port_mappings: op.port_mappings  ? op.port_mappings : [],
            labels: op.labels ? op.labels : {},
            env: op.env ? op.env : {},
            volumes : op.volumes ? op.volumes : [],
            force_pull : op.force_pull ? op.force_pull : false,
            args : op.args,
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
        var deleteUrl = meta + '/' + fqon + '/environments/' + eid + '/containers/' + container.id;
        console.log("\nSending 'DELETE' request to URL : " + deleteUrl);
        var deleteCon = new java.net.URL(deleteUrl).openConnection();
        deleteCon.setRequestProperty("Authorization", creds);
        deleteCon.setRequestMethod("DELETE");
        var deleteRespCode = deleteCon.getResponseCode();
        console.log("Response Code : " + deleteRespCode);
        if (deleteRespCode < 300) {
          return "SUCCESS";
        } else {
          console.warn("FAILURE; did not receive 20x from delete")
        }
    } else {
        console.warn("FAILURE; did not receive 201; will not delete old container")
    }
    return "FAILED";
}
