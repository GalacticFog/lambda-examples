var AsyncHttpClient   = Java.type('org.asynchttpclient.DefaultAsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');

var META   = null;
var LOG_APPENDER = new java.lang.StringBuffer();
var client = new AsyncHttpClient();

var EnvironmentTypes = {
    DEVELOPMENT: "development",
    PRODUCTION: "production",
    TEST: "test"
};

var ProviderTypes = {
    // for search
    GATEWAYMANAGER: "GatewayManager",
    KONG: "Kong",
    CAAS: "CaaS",
    LAMBDA: "Lambda",
    // for create
    DCOS: "Gestalt::Configuration::Provider::CaaS::DCOS",
    KUBE: "Gestalt::Configuration::Provider::CaaS::Kubernetes"
};

var FORCE_DELETE = true;
var DO_ASYNC = true;

var LoggingLevels = {
    ERROR: 3,
    WARNING: 2,
    INFO: 1,
    DEBUG: 0
};

function getAppLogLevel() {
    if (get_env("LOG_DEBUG", "false") == "true") {
        console.log("enabling debug logging");
        LOG_APPENDER.append("enabling debug logging\n");
        return LoggingLevels.DEBUG;
    }
    return LoggingLevels.INFO;
}

var loggingLevels = {
    applog:  getAppLogLevel(),
    console: LoggingLevels.DEBUG
};

function get_env(key,def) {
    var val = java.lang.System.getenv().get(key);
    if (val) return val;
    if (def) return def;
    throw "Env missing variable " + key;
}

function get_meta(args, creds) {
    log(creds, LoggingLevels.DEBUG);
    log(args, LoggingLevels.DEBUG);
    if (args && args.meta_url) {
        var meta_url = args.meta_url;
    } else {
        var meta_url = get_env("META_URL");
    }
    if (!creds || creds === "") {
        var api_key = get_env("API_KEY");
        var api_secret = get_env("API_SECRET");
        creds = "Basic " + javax.xml.bind.DatatypeConverter.printBase64Binary((api_key + ":" + api_secret).getBytes());
    }
    return {
        url: meta_url,
        creds: creds
    }
}

function getLog() {
    return LOG_APPENDER.toString();
}

function log(a, lvl) {
    var str;
    if (typeof(a) === 'object') {
        str = JSON.stringify(a);
    } else if (a == null) {
        str = 'null';
    } else {
        str = a.toString();
    }
    if (lvl === undefined) {
        lvl = LoggingLevels.INFO;
    }
    if (lvl >= loggingLevels.console) console.log(str);
    if (lvl >= loggingLevels.applog)  LOG_APPENDER.append(str + "\n");
}

function fqon(org) {
    return org.properties.fqon;
}

function find_entitlement(ents, entitlement_name) {
    for each (e in ents) if (e.properties.action == entitlement_name) return e;
    return null;
}

function contains(arr, v) {
    for each (a in arr) if (a == v) return true;
    return false;
}

function disp(r) {
    return r.name + "(" + r.id + ")"
}

// turn Array[Future[Updates]] into Future[Array[Updates]]
function sequence(futures) {
    return CompletableFuture.allOf(futures).thenApply(function(dummyVarIsNull){
        return futures.map(function(f){
            return f.join();
        });
    });
}


function add_entitlements(base_org, resource, entitlement_names, identity, async) {
    if (!Array.isArray(entitlement_names)) {
        entitlement_names = [entitlement_names];
    }
    var fEntUpdates = _GET("/" + fqon(base_org) + "/resources/" + resource.id + "/entitlements?expand=true", DO_ASYNC).thenCompose(function(ents) {
        return sequence(entitlement_names.map(function(ename){
            var ent = find_entitlement(ents, ename);
            if (!ent) {
                log("Could not locate entitlement " + ename + " on resource " + disp(resource));
                return CompletableFuture.completedFuture(null);
            }
            var cur_ids = ent.properties.identities.map(function(i) {return i.id;});
            if (contains(cur_ids, identity.id)) {
                log("Entitlement " + resource.name + "[" + ename + "] already contains identity " + disp(identity));
                return CompletableFuture.completedFuture(null);
            }
            var new_ent = {
                id: ent.id,
                name: ent.name,
                properties: {
                    action: ent.properties.action,
                    identities: cur_ids.concat(identity.id)
                }
            };
            log("Updating entitlement " + resource.name + "[" + ename + "] with identity " + disp(identity));
            switch (resource.resource_type) {
                case "Gestalt::Resource::Environment":
                    return _PUT("/" + fqon(base_org) + "/environments/" + resource.id + "/entitlements/" + ent.id, new_ent, DO_ASYNC);
                case "Gestalt::Resource::Workspace":
                    return _PUT("/" + fqon(base_org) + "/workspaces/" + resource.id + "/entitlements/" + ent.id, new_ent, DO_ASYNC);
                case "Gestalt::Resource::Organization":
                    return _PUT("/" + fqon(resource) + "/entitlements/" + ent.id, new_ent, DO_ASYNC);
                default:
                    return _PUT("/" + fqon(base_org) + "/entitlements/" + ent.id, new_ent, DO_ASYNC);
            }
        }));
    });
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) return fEntUpdates;
    return fEntUpdates.join();
}

function create_migrate_policy(base_org, environment, lambda) {
    log("creating new migrate policy in " + environment.name);
    var pol = _POST("/" + fqon(base_org) + "/environments/" + environment.id + "/policies", {
        name: "default-migrate-policy",
        description: "default container migration policy",
        properties: {}
    });

    log("creating migrate event rule in migrate policy " + pol.id + " against lambda " + lambda.id);
    _POST("/" + fqon(base_org) + "/policies/" + pol.id + "/rules", {
        name: "migration-handler",
        description: "execute migrate lambda on container.migrate.pre",
        resource_type: "Gestalt::Resource::Rule::Event",
        properties: {
            actions: [ "container.migrate.pre" ],
            eval_logic: {},
            lambda: lambda.id
        }
    });
}

function create_user(parent_org, account_payload) {
    log("Creating user " + fqon(parent_org) + "/" + account_payload.name);
    return _POST("/" + fqon(parent_org) + "/users", account_payload);
}

function find_user(parent_org, username) {
    log("Searching for user " + fqon(parent_org) + "/" + username);
    var users = _GET("/" + fqon(parent_org) + "/users/search?username=" + username);
    for each (user in users) if (user.name == username) return user;
    return null;
}

function delete_user(parent_org, user) {
    log("Deleting user " + fqon(parent_org) + "/" + disp(user));
    return _DELETE("/" + fqon(parent_org) + "/users/" + user.id);
}

function create_group(parent_org, name, desc) {
    log("Creating group " + parent_org.name + "/" + name);
    return _POST("/" + fqon(parent_org) + "/groups", {
        name: name,
        description: desc
    });
}

function find_group(parent_org, groupname) {
    log("Searching for group " + fqon(parent_org) + "/" + groupname);
    var groups = _GET("/" + fqon(parent_org) + "/groups/search?name=" + groupname);
    for each (group in groups) if (group.name == groupname) return group;
    return null;
}

function delete_group(parent_org, group) {
    log("Deleting group " + fqon(parent_org) + "/" + disp(group));
    return _DELETE("/" + fqon(parent_org) + "/groups/" + group.id);
}

function add_user_to_group(parent_org, group, user) {
    log("Adding user " + user.name + " to group " + group.name);
    _PATCH("/" + fqon(parent_org) + "/groups/" + group.id + "/users?id=" + user.id);
}

/*
 * providers
 */

function create_provider(parent_org, provider_payload) {
    log("Creating provider " + provider_payload.name);
    return _POST("/" + fqon(parent_org) + "/providers", provider_payload);
}

function list_providers(org, provider_type) {
    var endpoint = "/" + fqon(org) + "/providers?expand=true";
    if (provider_type) endpoint = endpoint + "&type=" + provider_type;
    return _GET(endpoint);
}

function find_provider(parent_org, provider_id, async) {
    return _GET("/" + fqon(parent_org) + "/providers/" + provider_id, async);
}

function redeploy_provider(parent_org, provider, async) {
    log("Redeploying provider " + disp(provider));
    return _POST("/" + fqon(parent_org) + "/providers/" + provider.id + "/redeploy", null, async);
}

function patch_provider(parent_org, provider, patch, async) {
    log("Patching provider " + disp(provider));
    return _PATCH("/" + fqon(parent_org) + "/providers/" + provider.id, patch, async);
}

/*
 * orgs
 */

function create_org(parent_org, name, description, async) {
    log("Creating org " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return _POST("/" + fqon(parent_org), payload, async)
}

function find_org(fqon, async) {
    return _GET("/" + fqon, async);
}

function delete_org(org, force, async) {
    var _force = force ? force : false;
    log("Deleting org " + fqon(org));
    return _DELETE("/" + fqon(org) + "?force=" + _force, async);
}

/*
 * environments
 */

function create_environment(parent_org, parent_workspace, name, description, type, async, f) {
    log("Creating environment " + parent_workspace.name + "/" + name);
    var payload = {
        description: description,
        name: name,
        properties: {
            environment_type: type
        }
    };
    return _POST("/" + fqon(parent_org) + "/workspaces/" + parent_workspace.id + "/environments", payload, async, f);
}

function find_environment(parent_org, environment_id, async) {
    return _GET("/" + fqon(parent_org) + "/environments/" + environment_id, async);
}

/*
 * workspaces
 */

function create_workspace(parent_org, name, description, async, f) {
    log("Creating workspace " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return _POST("/" + fqon(parent_org) + "/workspaces", payload, async, f);
}

/*
 * lambdas
 */

function create_lambda(parent_org, parent_env, lambda_payload) {
    log("Creating lambda " + parent_env.name + "/" + lambda_payload.name);
    return _POST("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/lambdas", lambda_payload);
}

function find_lambda_by_name(parent_org, parent_env, name) {

    // Note: There can be more than one lambda with the same name.  This function returns the first instance

    var endpoint = "/" + fqon(parent_org) + "/environments/" + parent_env.id + "/lambdas?expand=true";
    var lambdas = _GET(endpoint);
    for each (l in lambdas) if (l.name == name) return l;
    return null;
}

/*
 * containers
 */

function create_container(parent_org, parent_env, payload, async) {
    log("Creating container " + payload.name + " in " + fqon(parent_org) + "/environments/" + parent_env.id);
    return _POST("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers", payload, async);
}

function find_container_by_name(parent_org, parent_env, name) {
    var endpoint = "/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers?expand=true";
    var containers = _GET(endpoint);
    for each (c in containers) if (c.name == name) return c;
    return null;
}

function delete_container(parent_org, parent_env, container, async) {
    log("Deleting container " + disp(container) + " from " + fqon(parent_org) + "/environments/" + parent_env.id);
    return _DELETE("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers/" + container.id,async);
}

function patch_container(parent_org, parent_env, container, patch, async) {
    log("Patching container " + disp(container));
    return _PATCH("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/containers/" + container.id, patch, async);
}

function update_container(parent_org, container, async) {
    log("Updating container " + disp(container));
    return _PUT("/" + fqon(parent_org) + "/containers/" + container.id, container, async);
}

/*
 * apis
 */

function create_api(parent_org, parent_env, payload, async) {
    log("Creating api " + payload.name + " in " + fqon(parent_org) + "/environments/" + parent_env.id);
    return _POST("/" + fqon(parent_org) + "/environments/" + parent_env.id + "/apis", payload, async);
}

function find_api(parent_org, api_id, async) {
    return _GET("/" + fqon(parent_org) + "/apis/" + api_id, async);
}

function find_api_by_name(parent_org, parent_env, name) {
    var endpoint = "/" + fqon(parent_org) + "/environments/" + parent_env.id + "/apis?expand=true";
    var apis = _GET(endpoint);
    for each (api in apis) if (api.name == name) return api;
    return null;
}

/*
 * apiendpoints
 */

function create_apiendpoint(parent_org, parent_api, payload, async) {
    log("Creating apiendpoint " + payload.name + " in " + fqon(parent_org) + "/apis/" + parent_api.id);
    return _POST("/" + fqon(parent_org) + "/apis/" + parent_api.id + "/apiendpoints", payload, async);
}

function list_container_apiendpoints(org, container) {
    var endpoint = "/" + fqon(org) + "/containers/" + container.id + "/apiendpoints?expand=true";
    return _GET(endpoint);
}

function list_lambda_apiendpoints(org, lambda) {
    var endpoint = "/" + fqon(org) + "/lambdas/" + lambda.id + "/apiendpoints?expand=true";
    return _GET(endpoint);
}

function delete_endpoint(parent_org, endpoint, async) {
    log("Deleting endpoint " + disp(endpoint) + " from " + fqon(parent_org));
    return _DELETE("/" + fqon(parent_org) + "/apiendpoints/" + endpoint.id, async);
}

function update_endpoint_target(org, endpoint, new_target) {
    var patch = [{
        op: "replace",
        path: "/properties/implementation_id",
        value: new_target.id
    }];
    log(JSON.stringify(patch));
    var url = "/" + fqon(org) + "/apiendpoints/" + endpoint.id;
    return _PATCH(url, patch);
}

function find_endoint_by_name(parent_org, parent_api, name) {
    var endpoint = "/" + fqon(parent_org) + "/apis/" + parent_api.id + "/apiendpoints?expand=true";
    var eps = _GET(endpoint);
    for each (ep in eps) if (ep.name == name) return ep;
    return null;
}

/*
 * policy
 */

function create_policy(base_org, environment, name, description) {
    log("creating new policy in " + environment.name);
    return _POST("/" + fqon(base_org) + "/environments/" + environment.id + "/policies", {
        name: name,
        description: description ? description : "",
        properties: {}
    });
}

function create_event_rule(base_org, policy, name, description, lambdaId, actions) {
    log("creating new event rule in " + policy.name);
    return _POST("/" + fqon(base_org) + "/policies/" + policy.id + "/rules", {
        name: name,
        description: description ? description : "",
        properties: {
            parent: {},
            lambda: lambdaId,
            actions: actions
        },
        resource_type: "Gestalt::Resource::Rule::Event"
    });
}

function create_limit_rule(base_org, policy, name, description, actions, property, operator, value) {
    log("creating new limit rule in " + policy.name);
    return _POST("/" + fqon(base_org) + "/policies/" + policy.id + "/rules",{
        name: name,
        description: description ? description : "",
        properties: {
            parent: {},
            strict: false,
            actions: actions,
            eval_logic: {
                property: property,
                operator: operator,
                value: value
            }
        },
        resource_type: "Gestalt::Resource::Rule::Limit"
    });
}

/*
 * REST utilities
 */

function _handleResponse(response) {
    var code = response.getStatusCode();
    var body = response.getResponseBody();
    if (code == 404) {
        return null;
    } else if (code >= 300) {
        log("WARNING: status code " + code + " from " + response.getUri());
        log("response: " + body);
        throw code;
    } else if (code == 204) {
        return null;
    }
    if (response.getContentType() && response.getContentType().startsWith("application/json")) return JSON.parse(body);
    return body;
}

function _REST_JSON(method, endpoint, payload, async, fResponse) {
    var url = META.url + endpoint;
    var pc = client.prepareConnect(url)
        .setMethod(method)
        .addHeader("Authorization", META.creds);
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

function _DELETE(endpoint, async, fResponse) {
    return _REST_JSON("DELETE", endpoint, null, async, fResponse);
}

function _GET(endpoint, async, fResponse) {
    return _REST_JSON("GET", endpoint, null, async, fResponse);
}

function _POST(endpoint, payload, async, fResponse) {
    return _REST_JSON("POST", endpoint, payload, async, fResponse);
}

function _PUT(endpoint, payload, async, fResponse) {
    return _REST_JSON("PUT", endpoint, payload, async, fResponse);
}

function _PATCH(endpoint, payload, async, fResponse) {
    return _REST_JSON("PATCH", endpoint, payload, async, fResponse);
}
