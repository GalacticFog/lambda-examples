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
    var org        = cur_app.org;

    if (eventName === "container.create.post") {
        create_servicenow_container(sn_url, sn_token, {
            name: cur_app.name,
            short_description: cur_app.description,
            u_num_instances: cur_app.properties.num_instances,
            u_cpu: cur_app.properties.cpus,
            u_memory: cur_app.properties.memory,
            u_image: cur_app.properties.image,
            u_endpoints: get_container_endpoint_url(org, cur_app)
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
            u_endpoints: get_container_endpoint_url(org, cur_app)
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
