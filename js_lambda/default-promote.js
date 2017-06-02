function promote(args, ctx) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.1.0/js_lambda/gestalt-sdk.js');

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
        patch_container(parent_org, tgt_env, tgt_app, [{
            op: "replace",
            path: "/properties/image",
            value: cur_app.properties.image
        }]);
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    return "Container migrated.";
}

function find_container_by_name(parent_org, parent_env, name) {
    var endpoint = "/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers?expand=true";
    var containers = _GET(endpoint);
    for each (c in containers) if (c.name == name) return c;
    return null;
}

function patch_container(parent_org, parent_env, container, patch, async) {
    log("Patching container " + disp(container));
    return _PATCH("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers/" + container.id, patch, async);
}
