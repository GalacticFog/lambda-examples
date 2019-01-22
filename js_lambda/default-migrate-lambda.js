load("https://raw.githubusercontent.com/GalacticFog/lambda-examples/master/js_lambda/gestalt-sdk.js");

function migrate(args, ctx) {
    log("***** begin migrate ************");

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(args, ctx.creds);
    log("[init] found meta: " + META.url);

    var prv_id  = args.provider_id;
    var cur_lambda = args.resource;

    log("Will migrate lambda " + disp(cur_lambda) + " to provider " + prv_id);

    var parent_org = find_org(args.fqon);
    var parent_env = find_environment(parent_org, args.environment_id);
    if ( ! parent_env ) {
        log("ERROR: could not locate environment " + args.environment_id + " in org " + disp(parent_org));
        return getLog();
    }
    var tgt_provider = find_provider(parent_org, prv_id);
    if ( ! tgt_provider ) {
        log("ERROR: could not locate provider " + prv_id + " in org " + disp(parent_org));
        return getLog();
    }

    var cur_provider = find_provider(cur_lambda.org, cur_lambda.properties.provider.id);
    if ( ! cur_provider ) {
        log("ERROR: could not locate provider " + cur_lambda.properties.provider.id + " in org " + disp(cur_lambda.org));
        return getLog();
    }

    if(tgt_provider.resource_type == cur_provider.resource_type){
        log("Cannot migrate from " + cur_provider.resource_type + " to " + tgt_provider.resource_type + ", aborting")
        return getLog()
    }

    // aws lambda runtimes:
    // nodejs4.3, nodejs6.10, nodejs8.10, java8, python2.7, python3.6, dotnetcore1.0, dotnetcore2.0, dotnetcore2.1, nodejs4.3-edge, go1.x

    // laser runtimes:
    // nashorn, java;scala, csharp;dotnet, golang, nodejs, python, ruby

    var handler;
    var runtime;
    if(tgt_provider.resource_type == "Gestalt::Configuration::Provider::AWSLambda" && cur_provider.resource_type == "Gestalt::Configuration::Provider::Lambda") {
        //  laser => aws lambda
        log("Migrating a lambda from " + tgt_provider.resource_type + " to " + cur_provider.resource_type);

        switch(props.runtime) {
            case "java;scala":
                runtime = "java8";
                handler = props.handler.replace(";", "::");
                break;
            case "golang":
                runtime = "go1.x";
                handler = props.handler;
                break;
            case "nodejs":
                runtime = "nodejs8.10";
                handler = props.handler.replace(".js;", ".");
                break;
            case "python":
                // aborting due to incopatible handler format
                // runtime = "python3.6";
                // break;
            case "csharp;dotnet":
                // aborting due to incopatible handler format
                // runtime = "donetcore2.1";
                // break;
            case "nashorn":
            case "ruby":
            default:
                log("ERROR: Target lambda with " + props.runtime + " runtime is not supported by or compatible with " + tgt_provider.resource_type)
                return getLog();
        }
    }else if(tgt_provider.resource_type == "Gestalt::Configuration::Provider::Lambda" && cur_provider.resource_type == "Gestalt::Configuration::Provider::AWSLambda") {
        // aws lambda => laser
        log("Migrating a lambda from " + cur_provider.resource_type + " to " + tgt_provider.resource_type);

        switch(props.runtime) {
            case "nodejs4.3":
            case "nodejs6.10":
            case "nodejs8.10":
            case "nodejs4.3-edge":
                runtime = "nodejs";
                handler = props.handler.replace(".", ".js;");
                break;
            case "java8":
                runtime = "java;scala";
                handler = props.handler.replace("::", ";");
                break;
            case "go1.x":
                runtime = "golang";
                handler = props.handler;
                break;
            case "python2.7":
            case "python3.6":
                // aborting due to incopatible handler format
                // runtime = "python";
                // break;
            case "dotnetcore1.0":
            case "dotnetcore2.0":
            case "dotnetcore2.1":
                // aborting due to incopatible handler format
                // runtime = "csharp;dotnet";
                // break;
            default:
                log("ERROR: Target lambda with " + props.runtime + " runtime is not supported by or compatible with " + tgt_provider.resource_type)
                return getLog();
        }
    }else {
        // in case new providers are added
        handler = props.handler;
        runtime = props.runtime;
    }

    var new_lambda;
    try {
        var props = cur_lambda.properties;
        new_lambda = create_lambda(parent_org, parent_env, {
            name:        cur_lambda.name,
            description: cur_lambda.description,
            properties: {
                provider: {
                    id: prv_id
                },
                "public" : props.public,
                "cpus" : props.cpus,
                "code_type" : props.code_type,
                "code" : props.code,
                "package_url" : props.package_url,
                "timeout" : props.timeout,
                "handler" : handler,
                "runtime" : runtime,
                "memory" : props.memory
            }
        });
    } catch(err) {
        log("ERROR: error creating lambda: response code " + err);
        return getLog();
    }
    log("Created new lambda with id " + new_lambda.id);

    log("Updating ApiEndpoint targets");
    var endpoints = list_lambda_apiendpoints(parent_org, cur_lambda);
    for each (ep in endpoints) {
        try {
            update_endpoint_target(parent_org, ep, new_lambda);
        } catch (err) {
            log("WARNING: error updating apiendpoint: " + ep);
        }
    }

    try {
        delete_lambda(parent_org, parent_env, cur_lambda, false, true); // async=false, force=true
    } catch(err) {
        log("ERROR: error creating lambda: response code " + err);
        return getLog();
    }
    log("Deleted old lambda.");

    return getLog();
}