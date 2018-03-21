function promote(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');
    log("***** begin promote ************");

    var MASTER_IN_DEV = "review-app-master";
    var APP_IN_INT = "int-example-app";
    var APP_IN_PROD = "prod-example-app";

    var gitlab_url   = get_env("GITLAB_API_URL");
    var gitlab_token = get_env("GITLAB_TOKEN");

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );
    log(args, LoggingLevels.DEBUG);
    log(ctx,  LoggingLevels.DEBUG);
    // temporary fix until gestalt-policy is updated
    if (args.data) {
        args = args.data;
    }

    META = get_meta(args, ctx.creds);
    log("[init] found meta: " + META.url);

    var tgt_env_id = args.target_env_id;
    var cur_env_id = args.environment_id;

    var cur_app    = args.resource;

    var parent_org = find_org(args.fqon);

    var cur_env = find_environment(parent_org, cur_env_id);
    var tgt_env = find_environment(parent_org, tgt_env_id);

    log("request to promote container " + cur_app.name + " from " + cur_env.name + " to environment " + tgt_env.name);

    var tgt_app_name;
    if ( cur_env.properties.environment_type === EnvironmentTypes.DEVELOPMENT && tgt_env.properties.environment_type === EnvironmentTypes.TEST ) {
        if ( cur_app.name !== MASTER_IN_DEV ) {
            log("aborting: only container '" + MASTER_IN_DEV + "' may be promoted from dev to int");
            return getLog();
        }
        tgt_app_name = APP_IN_INT;
    } else if ( cur_env.properties.environment_type === EnvironmentTypes.TEST && tgt_env.properties.environment_type === EnvironmentTypes.PRODUCTION ) {
        if ( cur_app.name !== APP_IN_INT ) {
            log("aborting: only container '" + APP_IN_INT + "' may be promoted from int to prod");
            return getLog();
        }
        tgt_app_name = APP_IN_PROD;
    } else {
        log("aborting: policy does not allow promoting from " + cur_env.name + " to " + tgt_env.name);
        return getLog();
    }

    var tgt_app = find_container_by_name(parent_org, tgt_env, tgt_app_name);
    if ( ! tgt_app ) {
        log("ERROR: could not locate target container in environment " + tgt_env.name + " with name " + tgt_app_name);
        return getLog();
    }

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    log("located target app " + disp(tgt_app) );
    try {
        patch_container(parent_org, tgt_env, tgt_app, [
            replace("image", cur_app.properties.image),
            replace("env",   cur_app.properties.env)
        ]);
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Container successfully migrated.");

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    var container_endpoint_url = get_container_endpoint_url(parent_org, tgt_app);
    if ( container_endpoint_url ) {
        log("Searching for GitLab Environment");
        var gitlab_env = find_gitlab_environment(gitlab_url, gitlab_token, tgt_env.properties.environment_type);
        if ( gitlab_env ) {
            update_gitlab_environment(gitlab_url, gitlab_token, gitlab_env, {
                name: tgt_env.properties.environment_type,
                external_url: container_endpoint_url
            });
        } else {
            create_gitlab_environment(gitlab_url, gitlab_token, {
                name: tgt_env.properties.environment_type,
                external_url: container_endpoint_url
            });
        }
    } else {
        log("did not find container endpoint url, will not update environment external_url at gitlab")
    }

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    log("***** end promote **************");
    return "Container migrated.";
}

function replace(prop_path, value) {
    return {
        op: "replace",
        path: "/properties/" + prop_path,
        value: value
    }
}

function find_gitlab_environment(base_url, token, environment_name) {
    log("search for " + environment_name);
    var url = base_url + "/environments";
    var pc = client.prepareConnect(url)
        .setMethod("GET")
        .addHeader("PRIVATE-TOKEN", token);
    log("GET " + url, LoggingLevels.DEBUG);
    var envs = _handleResponse(pc.execute().get());
    for each (e in envs) if (e.name == environment_name) return e;
    return null;
}

function update_gitlab_environment(base_url, token, gitlab_env, payload) {
    var url = base_url + "/environments/" + gitlab_env.id;
    var pc = client.prepareConnect(url)
        .setMethod("PUT")
        .addHeader("PRIVATE-TOKEN", token);
    log("PUT " + url, LoggingLevels.DEBUG);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    return _handleResponse(pc.execute().get());
}

function create_gitlab_environment(base_url, token, payload) {
    var url = base_url + "/environments";
    var pc = client.prepareConnect(url)
        .setMethod("POST")
        .addHeader("PRIVATE-TOKEN", token);
    log("POST " + url, LoggingLevels.DEBUG);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    return _handleResponse(pc.execute().get());
}

function get_container_endpoint_url(parent_org, cntr) {
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
