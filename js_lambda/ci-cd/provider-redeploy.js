function run(args, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.4/js_lambda/gestalt-sdk.js');
    log("***** begin provider update/redeploy ************\n");

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(null, ctx.creds);
    log("[init] found meta: " + META.url);

    var root_org = find_org("root");
    if ( ! root_org ) {
        log("ERROR: could not find 'root' org");
        return getLog();
    }

    var new_image = args.image;
    if ( !new_image ) {
        log("ERROR: payload was missing 'image'");
        return getLog();
    }
    var provider_type = args.provider_type;
    if ( !provider_type ) {
        log("ERROR: payload was missing 'provider_type'");
        return getLog();
    }

    var git_ref    = args.git_ref;
    var git_sha    = args.git_sha;
    var git_author = args.git_author;
    var redeploy   = args.redeploy;

    var desc =
        "Last updated in CI: \n" +
        "Time: " + (new Date()).toString() + "\n" +
        "Author: " + git_author + "\n" +
        "Git ref: " + git_ref + "\n" +
        "SHA: " + git_sha + "\n";

    log("\nWill update image to " + new_image + " on service containers for providers of type " + provider_type);

    var providers = list_providers(root_org, provider_type);

    for each (p in providers) {
        var newsvc = null;
        if (p.properties && p.properties.services && p.properties.services.length > 0) {
            svc = p.properties.services[0];
            if (svc.container_spec && svc.container_spec.properties && svc.container_spec.properties.image) {
                svc["container_spec"]["properties"]["image"] = new_image;
                newsvc = svc;
            }
        }
        if (newsvc) {
            patch_provider(root_org, p, [
                patch_replace("/description", desc),
                patch_replace("/properties/services", [newsvc])
            ]);
            log("Provider updated.");

            log("");

            if (redeploy) {
                log("Redeploy requested, will redeploy...");
                redeploy_provider(root_org, p);
            } else {
                log("Redeploy not requested, will not redeploy.");
            }
        } else {
            log("Provider " + disp(p) + " did not have any well-formed services.");
        }
    }

    log("\n***** done with provider update/redeploy ************\n");
    return getLog();
}

function patch_replace(path, value) {
    return {
        op: "replace",
        path: path,
        value: value
    }
}

