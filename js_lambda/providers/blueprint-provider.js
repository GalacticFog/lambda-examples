function run(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.4/js_lambda/gestalt-sdk.js');
    log("***** begin blueprint provider action ************\n");

    args = JSON.parse( args );
    log(args);

    action = args.action;

    if (action === "blueprint.update" || action === "blueprint.create") {
        return _createOrUpdate(args.resource);
    } else if (action === "blueprint.deploy") {
        deployTarget = args.context.queryParams.deployTarget[0];
        return _deploy(args.resource, deployTarget);
    } else if (action === "blueprint.import") {
        importTarget = args.context.queryParams.importTarget[0];
        return _import(args.resource, importTarget);
    }
    return "{}";
}

function _createOrUpdate(resource) {
    resource.properties.canonical_form = "meta-fy(" + resource.properties.native_form + ")";
    resource.properties.provider = resource.properties.provider.id;
    log(resource);
    return JSON.stringify(resource);
}

function _import(resource, importTarget) {
    resource.properties.native_form = ""
    resource.properties.blueprint_type = "meta-import"
    resource.properties.canonical_form = "meta canonical form imported from resource " + importTarget;
    resource.properties.provider = resource.properties.provider.id;
    log(resource);
    return JSON.stringify(resource);
}

function _deploy(resource, deployTarget) {
    return JSON.stringify({
        "message": "deployed blueprint " + resource.id + " to location " + deployTarget
    });
}
