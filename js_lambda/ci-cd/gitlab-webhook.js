var project = null;
var user = null;

function run(payload, ctx) {
  load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.4/js_lambda/gestalt-sdk.js');
  log("***** begin gitlab callback ************\n");

  payload = JSON.parse( payload );
  ctx  = JSON.parse( ctx );

  var gitlab_webhook_token = get_env('GITLAB_WEBHOOK_TOKEN');

  if (ctx.headers['X-Gitlab-Token'] != gitlab_webhook_token) {
    throw "Missing expected X-Gitlab-Token";
  }

  // log(payload);
  // log(ctx);

  META = get_meta(null, null);
  log("[init] found meta: " + META.url);

  project = payload.project.path_with_namespace;
  user = payload.user.name;

  if (payload.object_kind === "pipeline") {
      log("pipeline event for " + project + " by " + user);
      return _process_pipeline(project, payload);
  }
  else {
      return "null-op";
  }
}

function _process_pipeline(payload) {
    return "_process_pipeline done";
}
