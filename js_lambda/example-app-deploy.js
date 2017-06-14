function deploy(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/gitlab-demo/js_lambda/gestalt-sdk.js');
    log("***** begin documentation review deploy ************\n");

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(null, null);
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

    var gitlab_url = get_env("GITLAB_API_URL");
    var gitlab_token = get_env("GITLAB_TOKEN");

    var commit_sha = args.substr(0,8);
    var full_sha   = args;
    var tgt_image  = "galacticfog/example-website:" + commit_sha;

    log("Will deploy image " + tgt_image + " to provider " + tgt_provider.name);

    var new_app;
    try {
        var payload = {
            name:        "docs-review-" + commit_sha,
            description: "documentation site deploy by gitlab, commit " + commit_sha,
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
                    "COMMIT_SHA": commit_sha
                },
                force_pull :    true
            }
        };
        log("container create payload: " + JSON.stringify(payload), LoggingLevels.DEBUG);
        new_app = create_container(tgt_org, tgt_env, payload);
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Created new container with id " + new_app.id);

    log("Creating ApiEndpoint target");
    var new_apiendpoint = create_apiendpoint(tgt_org, tgt_api, {
        name: "docs-review-" + commit_sha,
        properties: {
            implementation_type: "container",
            implementation_id: new_app.id,
            container_port_name: "web",
            resource: "/docs-review-" + commit_sha + "/"
        }
    });
    var new_url = "https://gtw1.demo7.galacticfog.com/equity-docs" + new_apiendpoint.properties.resource
    log("Created api-endpoint for container with id " + new_apiendpoint.id + " at " + new_url);

    log("Calling back to GitLab to provision new environment");
    create_gitlab_environment(gitlab_url, gitlab_token, {
        id: "galacticfog%2Fexample-website",
        name: "review-" + commit_sha,
        external_url: new_url
    });

    log("\n***** done with documentation review deploy ************");
    return getLog();
}



function create_gitlab_environment(base_url, token, payload, async) {
    var url = base_url + "/environments";
    var pc = client.prepareConnect(url)
        .setMethod("POST")
        .addHeader("PRIVATE-TOKEN", token);
    log("POST " + url, LoggingLevels.DEBUG);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) {
        if (!fResponse) fResponse = new CompletableFuture();
        pc.execute(new org.asynchttpclient.AsyncCompletionHandler({
            onCompleted: function(response) {
                fResponse.complete(_handleResponse(response));
            }
        }));
        return fResponse;
    }
    return _handleResponse(pc.execute().get());
}
