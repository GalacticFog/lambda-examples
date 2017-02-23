function run(/* arguments, credentials */) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/master/js_lambda/gestalt-sdk.js');

    META = get_meta();
    log("[init] found meta: " + META.url);
    var root_org = find_org("root");
    log("[init] found root: " + root_org.id);
    log("")

    var jdoe = find_user(root_org, "jdoe");
    if (jdoe) {
        delete_user(root_org, jdoe);
    } else {
        log("did not find user 'jdoe'");
    }
    log("")

    var trading_grp = find_group(root_org, "trading");
    if (trading_grp) {
        delete_group(root_org, trading_grp);
    } else {
        log("did not find group 'trading'");
    }
    log("")

    var demo_org = find_org("galactic-capital");
    if (demo_org) {
        // do this async, because it takes a long time
        delete_org(demo_org, FORCE_DELETE, DO_ASYNC);
        log("[demo org deleted in the background, this lambda not wait for the completion of that request]")
    } else {
        log("did not find org 'galactic-capital'");
    }
    log("")

    log("Demo environment removed");
    return LOG.toString();
}
