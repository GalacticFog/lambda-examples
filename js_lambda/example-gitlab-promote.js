function promote(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/gitlab-demo/js_lambda/gestalt-sdk.js');
    log("***** begin promote ************");

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(args, ctx.creds);
    log("[init] found meta: " + META.url);

    var tgt_env_id = args.target_env_id;
    var cur_env_id = args.environment_id;

    var cur_app    = args.resource;

    var parent_org = find_org(args.fqon);

    var cur_env = find_environment(parent_org, cur_env_id);
    var tgt_env = find_environment(parent_org, tgt_env_id);

    var gitlab_url   = get_env("GITLAB_API_URL");
    var gitlab_token = get_env("GITLAB_TOKEN");

    log("request to promote container " + cur_app.name + " from " + cur_env.name + " to environment " + tgt_env.name);

    var tgt_app = find_container_by_name(parent_org, tgt_env, "equity-docs-site");
    if ( ! tgt_app ) {
        log("ERROR: could not locate target container in environment " + tgt_env.name + " with name " + cur_app.name);
        return getLog();
    }

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

    log("Searching for GitLab Environment");
    var prod_env = find_gitlab_environment(gitlab_url, gitlab_token, "production");
    if ( prod_env ) {
        update_gitlab_environment(gitlab_url, gitlab_token, prod_env, {
            name: "production",
            external_url: "https://gtw1.demo7.galacticfog.com/equity-docs/"
        });
    } else {
        create_gitlab_environment(gitlab_url, gitlab_token, {
            name: "production",
            external_url: "https://gtw1.demo7.galacticfog.com/equity-docs/"
        });
    }

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
