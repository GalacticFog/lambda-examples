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
    var redeploy_downstream = args.redeploy_downstream;

    var desc =
        "Last updated in CI: \n" +
        "Time: " + (new Date()).toString() + "\n" +
        "Author: " + git_author + "\n" +
        "Git ref: " + git_ref + "\n" +
        "SHA: " + git_sha + "\n";

    log("\nWill update image to " + new_image + " on executors of type " + provider_type);

    var providers = list_providers(root_org, provider_type);
    var lambda_providers = list_providers(root_org, "Lambda");

    for each (p in providers) {
        if (p.properties &&
            p.properties.config &&
            p.properties.config.env &&
            p.properties.config.env.public &&
            p.properties.config.env.public.IMAGE)
        {
            patch_provider(root_org, p, [
                patch_replace("/description", desc),
                patch_replace("/properties/config/env/public/IMAGE", new_image)
            ]);
            log("Provider updated.");
        } else {
            log("Provider " + disp(p) + " did not have expected variable.");
        }
    }

    log("");

    if (redeploy_downstream) {
        log("Redeploy downstream requested, searching for downstream providers...");
        for each(maybe_downstream in lambda_providers) {
            if ( is_linked(p, maybe_downstream) ) {
                log("Provider " + disp(maybe_downstream) + " is linked, will redeploy...");
                redeploy_provider(root_org, maybe_downstream);
            }
        }
    } else {
        log("Redeploy downstream not requested, will not redeploy downstream.");
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

function is_linked(upstream, maybe_downstream) {
    var lps = [];
    if (maybe_downstream.properties && maybe_downstream.properties.linked_providers) {
        lps = maybe_downstream.properties.linked_providers;
    }
    for each (lp in lps) {
        if (lp.id == upstream.id) return true;
    }
    return false;
}

