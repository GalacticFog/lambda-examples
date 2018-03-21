function deploy(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/gitlab-demo/js_lambda/gestalt-sdk.js');
    log("***** begin documentation review deploy ************\n");

    ctx  = JSON.parse( ctx );

    var gitlab_url   = get_env("GITLAB_API_URL");
    var gitlab_token = get_env("GITLAB_TOKEN");

    var full_sha   = ctx.params.sha[0];
    var short_sha = full_sha.substr(0,8);
    var git_ref    = ctx.params.ref[0];
    var tgt_image  = "galacticfog/example-nginx:" + short_sha;

    if ( git_ref.startsWith("wip-") ) {
        log("Will not deploy review app: git ref starts with 'wip-'");
        return getLog();
    }

    META = get_meta(null, ctx.creds);
    log("[init] found meta: " + META.url);

    var tgt_org = find_org(get_env("TARGET_ORG"));
    if ( ! tgt_org ) {
        log("ERROR: could not find target org");
        return getLog();
    }

    var tgt_env = find_environment(tgt_org, get_env("TARGET_ENV"));
    if ( ! tgt_env ) {
        log("ERROR: could not find target environment");
        return getLog();
    }

    var tgt_provider = find_provider(tgt_org, get_env("TARGET_PROVIDER"));
    if ( ! tgt_provider ) {
        log("ERROR: could not find target provider");
        return getLog();
    }

    var tgt_api = find_api(tgt_org, get_env("TARGET_API"));
    if ( ! tgt_api ) {
        log("ERROR: could not find target API");
        return getLog();
    }

    var tgt_gateway;
    if ( tgt_api.properties.provider.locations && tgt_api.properties.provider.locations.length > 0 ) {
        var id = tgt_api.properties.provider.locations[0];
        tgt_gateway = find_provider(tgt_org, id);
    }
    if ( ! tgt_gateway ) {
        log("ERROR: could not find target gateway (kong) provider")
        return getLog();
    }
    var base_url;
    if ( tgt_gateway.properties.config.external_protocol && tgt_gateway.properties.config.env.public.PUBLIC_URL_VHOST_0 ) {
        base_url = tgt_gateway.properties.config.external_protocol + "://" + tgt_gateway.properties.config.env.public.PUBLIC_URL_VHOST_0;
    }
    if ( ! base_url ) {
        log("ERROR: could not determine base url for target gateway (kong) provider");
        return getLog();
    }
    log("kong provider base_url: " + base_url);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    log("Will deploy image " + tgt_image + " to provider " + tgt_provider.name);
    var review_app_name = "review-" + git_ref;
    var app;
    try {
        var payload = {
            name:        "review-app-" + git_ref,
            description: "documentation site deploy by gitlab, ref " + git_ref + ", sha " + short_sha,
            properties: {
                provider: {
                    id: tgt_provider.id
                },
                num_instances:  1,
                cpus:           0.1,
                memory:         128.0,
                disk:           0.0,
                container_type: "DOCKER",
                image:          tgt_image,
                network:        "BRIDGE",
                port_mappings:  [{
                    protocol: "tcp",
                    name: "web",
                    expose_endpoint: true,
                    container_port: 80
                }],
                labels:         {
                    "COMMIT_SHA": full_sha,
                    "GIT_REF": git_ref,
                    "REVIEW_APP": review_app_name
                },
                force_pull :    true
            }
        };
        log("container update/create payload: " + JSON.stringify(payload), LoggingLevels.DEBUG);

        app = find_container_by_name(tgt_org, tgt_env, payload.name);
        if ( app ) {
            app = patch_container(tgt_org, tgt_env, app, [
                patch_replace("image", payload.properties.image),
                patch_replace("labels", payload.properties.labels)
            ]);
        } else {
            app = create_container(tgt_org, tgt_env, payload);
        }
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Created new container with id " + app.id);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    var apiendpoint = find_endoint_by_name(tgt_org, tgt_api, "review-app-" + git_ref);
    if ( ! apiendpoint ) {
        apiendpoint = create_apiendpoint(tgt_org, tgt_api, {
            name: "review-app-" + git_ref,
            properties: {
                implementation_type: "container",
                implementation_id: app.id,
                container_port_name: "web",
                resource: "/review-app-" + git_ref + "/",
                plugins: {
                    gestaltSecurity: {
                        enabled: true,
                        groups: [],
                        users: []
                    },
                },
                methods: ["GET"]
            }
        });
    } else {
        log("ApiEndpoint already existed, will leave it intact.");
    }
    var new_url = base_url + "/" + tgt_api.name + apiendpoint.properties.resource;
    log("Created api-endpoint for container with id " + apiendpoint.id + " at " + new_url);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    log("Searching for associated GitLab Environment");
    var gitlab_env = find_gitlab_environment(gitlab_url, gitlab_token, review_app_name);
    if ( gitlab_env ) {
        log("Calling back to GitLab to provision new environment");
        update_gitlab_environment(gitlab_url, gitlab_token, gitlab_env, {
            external_url: new_url
        });
    } else {
        log("WARNING: Could not locate GitLab environment in order to update external_url");
    }

    log("\n***** done with documentation review deploy ************");
    return getLog();
}

function stop(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/gitlab-demo/js_lambda/gestalt-sdk.js');
    log("***** begin documentation review stop ************\n");

    ctx  = JSON.parse( ctx );

    META = get_meta(null, ctx.creds);
    log("[init] found meta: " + META.url);

    var tgt_org = find_org(get_env("TARGET_ORG"));
    if ( ! tgt_org ) {
        log("ERROR: could not find target org");
        return getLog();
    }

    var tgt_env = find_environment(tgt_org, get_env("TARGET_ENV"));
    if ( ! tgt_env ) {
        log("ERROR: could not find target environment");
        return getLog();
    }

    var git_ref    = ctx.params.ref[0];
    log("Will delete deployment associated with commit " + git_ref);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    var tgt_cntr = find_container_by_name(tgt_org, tgt_env, "review-app-" + git_ref);
    if ( tgt_cntr ) {
        log("Listing endpoints for container");
        var endpoints = list_container_apiendpoints(tgt_org, tgt_cntr);
        for each (e in endpoints) {
            delete_endpoint(tgt_org, e);
        }
        delete_container(tgt_org, tgt_env, tgt_cntr);
    } else {
        log("did not find any deployments matching that name");
    }

    log("\n***** done with documentation review stop ************");
    return getLog();
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

function patch_replace(prop_path, value) {
    return {
        op: "replace",
        path: "/properties/" + prop_path,
        value: value
    }
}

