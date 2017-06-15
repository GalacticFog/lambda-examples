function promote(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.2.0/js_lambda/gestalt-sdk.js');
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

    log("request to promote container " + cur_app.name + " from " + cur_env.name + " to environment " + tgt_env.name);

    var tgt_app = find_container_by_name(parent_org, tgt_env, cur_app.name);
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
