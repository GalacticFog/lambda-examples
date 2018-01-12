var marathon = null;

function run(payload, ctx) {
    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.4/js_lambda/gestalt-sdk.js');
    log("***** begin legacy CI ************\n");

    payload = JSON.parse( payload );
    ctx  = JSON.parse( ctx );

    console.log(payload);
    console.log(ctx);

    marathon   = "http://" + get_env("MARATHON_HOSTNAME") + ":8080";
    var project    = payload.project;
    var git_ref    = payload.git_ref;
    var git_sha    = payload.git_sha;
    var git_author = payload.git_author;
    var image      = payload.image;

    var app_id = null;
    switch (project) {
        case "ui":
            app_id = "test-galacticfog-com/ui-react";
            break;
        case "gestalt-meta":
            app_id = "test-galacticfog-com/meta";
            break;
        case "gestalt-security":
            app_id = "test-galacticfog-com/security";
            break;
        default:
            throw "Invalid 'project': " + project;
    }

    var cur_app = _MARATHON("GET", "/v2/apps/" + app_id).app;
    console.log("current app:\n" + JSON.stringify(cur_app));
    log(cur_app.id + " currently using image '" + cur_app.container.docker.image + "', will update to image '" + image + "'");

    var new_labels = cur_app.labels;
    new_labels.GIT_SHA = git_sha;
    new_labels.GIT_REF = git_ref;
    new_labels.GIT_AUTHOR = git_author;
    var new_container = cur_app.container;
    new_container.docker.image = image;
    var new_app = {
        container: new_container,
        labels: new_labels
    };

    console.log("new payload:\n" + JSON.stringify(new_app));
    var new_app_deployment = _MARATHON("PUT", "/v2/apps/" + app_id + "?force=true", new_app);
    log("new deployment: " + new_app_deployment.deploymentId);

    try {
        slack_path = get_env("SLACK_PATH");
        slack_url = "https://hooks.slack.com" + slack_path;
        _SLACK(slack_url, "_" + image + "_ deployed to test" + (git_author ? " by *" + git_author + "*": ""));
        log("posted message to slack");
    } catch (err) {
        log("Caught error posting message to slack");
        log(err);
    }

    log("\n***** end legacy CI ************\n");
    return getLog();
}

function _SLACK(url, message) {
    return _REST("POST", url, {
        text: message,
        mrkdwn: true
    });
}

function _MARATHON(method, endpoint, payload) {
    return _REST(method, marathon + endpoint, payload);
}

function _REST(method, url, payload, async, fResponse) {
    var pc = client.prepareConnect(url)
        .setMethod(method);
    log(method + " " + url, LoggingLevels.DEBUG);
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
