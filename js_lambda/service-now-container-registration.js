function run(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.4/js_lambda/gestalt-sdk.js');
    log("***** begin service now container accounting ************\n");

    args = JSON.parse( args );
    eventName = args.eventName;
    args = args.data;

    log("eventName: " + eventName);

    var sn_url   = get_env("SN_URL");
    var sn_token = get_env("SN_TOKEN");

    var cur_app    = args.resource;

    if (eventName === "container.create.post") {
        create_servicenow_container(sn_url, sn_token, {
            name: cur_app.name,
            short_description: cur_app.description,
            u_num_instances: cur_app.properties.num_instances,
            u_cpu: cur_app.properties.cpus,
            u_memory: cur_app.properties.memory,
            u_image: cur_app.properties.image,
            u_endpoints: get_container_endpoint_url(cur_app)
        });
    } else if (eventName === "container.delete.post") {
        delete_servicenow_container(sn_url, sn_token, cur_app.name);
    } else {
        update_servicenow_container(sn_url, sn_token, cur_app.name, {
            short_description: cur_app.description,
            u_num_instances: cur_app.properties.num_instances,
            u_cpu: cur_app.properties.cpus,
            u_memory: cur_app.properties.memory,
            u_image: cur_app.properties.image,
            u_endpoints: get_container_endpoint_url(cur_app)
        });
    }

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

function delete_servicenow_container(url, token, name) {
    log("deleting servicenow container");
    var pc = client.prepareConnect(url)
        .setMethod("GET")
        .addHeader("Authorization", token);
    log("GET " + url, LoggingLevels.DEBUG);
    containers = _handleResponse(pc.execute().get());
    log("found containers");
    log(containers.result);
    for each (r in containers.result) if (r.name == name) {
        var rurl = url + "/" + r.sys_id;
        var pc = client.prepareConnect(rurl)
            .setMethod("DELETE")
            .addHeader("Authorization", token);
        log("DELETE " + rurl, LoggingLevels.DEBUG);
        containers = _handleResponse(pc.execute().get());
    }
}

function update_servicenow_container(url, token, name, payload) {
    log("updating servicenow container");
    var pc = client.prepareConnect(url)
        .setMethod("GET")
        .addHeader("Authorization", token);
    log("GET " + url, LoggingLevels.DEBUG);
    containers = _handleResponse(pc.execute().get());
    log("found containers");
    log(containers.result);
    for each (r in containers.result) if (r.name == name) {
        var rurl = url + "/" + r.sys_id;
        var pc = client.prepareConnect(rurl)
            .setMethod("PUT")
            .addHeader("Authorization", token)
            .setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json");
        log("PUT " + rurl, LoggingLevels.DEBUG);
        return _handleResponse(pc.execute().get());
    }
}

function get_container_endpoint_url(cntr) {
    parent_org = cntr.org;
    log("Listing endpoints for container");
    var endpoints = list_container_apiendpoints(parent_org, cntr);
    if (endpoints === null || endpoints.length == 0) {
        log("did not find any endpoints on the container");
        return null;
    }
    var endpoint = endpoints[0];

    var tgt_gateway;
    if ( endpoint.properties.location_id ) {
        log("finding provider for endpoint " + endpoint.id);
        tgt_gateway = find_provider(parent_org, endpoint.properties.location_id);
    }
    if ( ! tgt_gateway ) {
        log("could not find target gateway (kong) provider");
        return null;
    }
    log("found gateway provider " + tgt_gateway.name);
    var base_url;
    if ( tgt_gateway.properties.config.external_protocol && tgt_gateway.properties.config.env.public.PUBLIC_URL_VHOST_0 ) {
        base_url = tgt_gateway.properties.config.external_protocol + "://" + tgt_gateway.properties.config.env.public.PUBLIC_URL_VHOST_0;
    }
    if ( ! base_url ) {
        log("ERROR: could not determine base url for target gateway (kong) provider");
        return getLog();
    }
    log("gateway provider base URL is " + base_url);
    return base_url + "/" + endpoint.properties.parent.name + endpoint.properties.resource;
}
