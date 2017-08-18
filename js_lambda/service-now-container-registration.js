function run(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.3.0/js_lambda/gestalt-sdk.js');
    log("***** begin service now container accounting ************\n");

    ctx  = JSON.parse( ctx );
    args = JSON.parse( args );

    var sn_url   = get_env("SN_URL");
    var sn_token = get_env("SN_TOKEN");

    var cur_app    = args.resource;

    create_servicenow_container(sn_url, sn_token, {
        name: cur_app.name,
        u_num_instances: cur_app.properties.num_instances,
        u_cpus: cur_app.properties.cpus,
        u_memory: cur_app.properties.memory,
        u_image: cur_app.properties.image,
        u_service_address: get_service_address(cur_app)
    });

    log("\n***** done service now container accounting ************");
    return getLog();
}

function create_servicenow_container(url, token, payload) {
    var pc = client.prepareConnect(url)
        .setMethod("POST")
        .addHeader("Authorization", token);
    log("POST " + url, LoggingLevels.DEBUG);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    return _handleResponse(pc.execute().get());
}

function get_service_address(container) {
    if ( ! container.properties.port_mappings ) return null;
    for each (pm in container.properties.port_mappings) {
        if (pm.virtual_hosts && pm.virtual_hosts.length > 0) return ("https://" + pm.virtual_hosts[0]);
    }
    return null;
}

