var AsyncHttpClient   = Java.type('com.ning.http.client.AsyncHttpClient');
var CompletableFuture = Java.type('java.util.concurrent.CompletableFuture');

var META   = null;
var LOG    = new java.lang.StringBuilder();
var client = new AsyncHttpClient();

function cleanup_demo(/* arguments, credentials */) {
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
    } else {
        log("did not find org 'galactic-capital'");
    }
    log("")

    log("Demo environment removed");
    return LOG.toString();
}

function setup_demo(/* arguments, credentials */) {
    META = get_meta();
    log("[init] found meta: " + META.url);

    var root_org = find_org("root");
    log("[init] found root org:" + root_org.id);

    // find kong provider
    var kong = list_providers(root_org, ProviderTypes.APIGATEWAY);
    if (kong.length == 0) {
        log("error: Could not find any ApiGateway providers");
        return LOG.toString();
    }
    else kong = kong[0];
    log("")

    try {
        var trading_grp = create_group(root_org, "trading", "Trading group");
    } catch(err) {
        if (err == 409) {
            log("group 'trading' already existed");
            return LOG.toString();
        } else throw err;
    }
    try {
        var joe_the_trader = create_user(root_org, {
            description: "Principal Engineer (Trading group)",
            name: "jdoe",
            properties: {
                firstName: "J",
                lastName: "Doe",
                password: "joethetrader",
                email: "jdoe@galacticfog.com",
                gestalt_home: "galactic-capital",
                phoneNumber: "+15555555555"
            }
        });
    } catch(err) {
        if (err == 409) {
            log("user 'jdoe' already existed");
            return LOG.toString();
        } else throw err;
    }
    add_user_to_group(root_org, trading_grp, joe_the_trader);
    log("")

    try {
        var demo_org = create_org(root_org, "galactic-capital", "Galactic Capital Corporation");
    } catch(code) {
        if (code == 409) return "Org already exists; delete it and then try again.";
        else return "Code " + code + " on attempt to create new org.";
    }

    // create marathon-dev provider in new org
    create_provider(demo_org, {
            name: "marathon-dev",
            resource_type: "Gestalt::Configuration::Provider::Marathon",
            description: "",
            properties: {
                locations: [ { name: "dcos-cluster", enabled: true } ],
                config: {
                    url: "http://master.mesos/service/marathon-dev",
                    auth: { scheme: "Basic", username: "open", password: "sesame" },
                    networks: [ { name: "HOST" }, { name: "BRIDGE" } ]
                }
            }
        }
    );
    add_entitlement(root_org, root_org, "provider.view", trading_grp, DO_ASYNC);
    log("")

    // create and populate demo sub-orgs: hr, it, debt, equity, private-client
    var equityDemo = populate_demo_org("equity",         "Equity Division",         demo_org);
    var HrDemo     = populate_demo_org("hr",             "HR Division",             demo_org);
    var ItDemo     = populate_demo_org("it",             "IT Division",             demo_org);
    var DebtDemo   = populate_demo_org("debt",           "Debt Division",           demo_org);
    var PCDemo     = populate_demo_org("private-client", "Private Client Division", demo_org);

    // additionally, equity.galactic-capital gets workspace "trading"
    var equityDiv = equityDemo.fOrg.get();
    var trading_wrk  = create_workspace(equityDiv, "trading", "Trading application platform");
    var trading_dev  = create_environment(equityDiv, trading_wrk, "dev", "Development", EnvironmentTypes.DEVELOPMENT);
    var trading_prod = create_environment(equityDiv, trading_wrk, "prod", "Production", EnvironmentTypes.PRODUCTION);
    var trading_qa   = create_environment(equityDiv, trading_wrk, "qa",   "QA",         EnvironmentTypes.TEST);

    add_entitlement(demo_org,  demo_org,     "org.view",         trading_grp, DO_ASYNC);
    add_entitlement(equityDiv, trading_wrk,  "workspace.view",   trading_grp, DO_ASYNC);
    add_entitlement(equityDiv, trading_wrk,  "environment.view", trading_grp, DO_ASYNC);
    for each (env in [trading_dev, trading_prod, trading_qa]) {
        for each (ent in ["container.create", "container.view", "container.update", "container.delete", "container.scale", "container.migrate",
                          "lambda.create", "lambda.view", "lambda.update", "lambda.delete"]) {
            add_entitlement(equityDiv, env, ent, trading_grp, DO_ASYNC);
        }
    }

    log("")
    var global_work = create_workspace(demo_org, "global", "global workspace");
    var global_env  = create_environment(demo_org, global_work, "global", "global environment", EnvironmentTypes.PRODUCTION);
    var migrate_lambda = create_lambda(demo_org, global_env, {
        description: "",
        name: "migrate-lambda",
        properties: {
            code_type: "package",
            compressed: false,
            cpus: 0.,
            env: {},
            handler: "migrate-lambda;migrate",
            headers: {},
            memory: 512,
            package_url: "https://raw.githubusercontent.com/GalacticFog/lambda-examples/master/js_lambda/migrate-lambda.js",
            providers: [
                {
                    id: kong.id,
                    locations: kong.properties.locations.map(function(l) {return {
                        name: l.name,
                        enabled: l.enabled,
                        selected: true
                    }})
                }
            ],
            public: true,
            runtime: "nodejs",
            synchronous: false,
            timeout: 120
        }
    });
    log("\ncreated migrate lambda: " + migrate_lambda.id);
    create_migrate_policy(equityDiv, equityDemo.fDev.get(),  migrate_lambda);
    create_migrate_policy(equityDiv, equityDemo.fProd.get(), migrate_lambda);
    create_migrate_policy(equityDiv, equityDemo.fQA.get(),   migrate_lambda);

    log("\nDemo environment complete.")
    return LOG.toString();
}

var EnvironmentTypes = {
    DEVELOPMENT: "development",
    PRODUCTION: "production",
    TEST: "test"
};

var ProviderTypes = {
    APIGATEWAY: "ApiGateway",
    MARATHON: "Marathon"
};

var FORCE_DELETE = true;
var DO_ASYNC = true;

function populate_demo_org(name, description, base_org) {
    // asynchronously create org, workspace, and three environments
    var fDev  = new CompletableFuture();
    var fProd = new CompletableFuture();
    var fQA   = new CompletableFuture();
    var fWrk  = new CompletableFuture();

    var fOrg = create_org(base_org, name, description, DO_ASYNC);
    fOrg.thenApply(function (org) {
        create_workspace(org, name+"-platform", description + " application platform", DO_ASYNC, fWrk);
        fWrk.thenApply(function (wrk) {
            create_environment(org, wrk, "dev",  "Development", EnvironmentTypes.DEVELOPMENT, DO_ASYNC, fDev);
            create_environment(org, wrk, "prod", "Production",  EnvironmentTypes.PRODUCTION,  DO_ASYNC, fProd);
            create_environment(org, wrk, "qa",   "QA",          EnvironmentTypes.TEST,        DO_ASYNC, fQA);
        })
    });
    return {
        fOrg: fOrg,
        fWrk: fWrk,
        fDev: fDev,
        fProd: fProd,
        fQA: fQA
    };
}

function get_env(key) {
    var val = java.lang.System.getenv().get(key);
    if (!val) throw "Env missing variable " + key;
    return val;
}

function get_meta(args, creds) {
    var api_key = get_env("API_KEY");
    var api_secret = get_env("API_SECRET");
    var login_hash = javax.xml.bind.DatatypeConverter.printBase64Binary((api_key + ":" + api_secret).getBytes());
    return {
        url: get_env("META_URL"),
        creds: "Basic " + login_hash
    }
}

function log(a) {
    var str;
    if (typeof(a) === 'object') {
        str = JSON.stringify(a);
    }
    else {
        str = a.toString();
    }
    console.log(str);
    LOG.append(str + "\n");
}

function list_providers(org, provider_type) {
    var endpoint = "/" + org.properties.fqon + "/providers?expand=true";
    if (provider_type) endpoint = endpoint + "&type=" + provider_type;
    return _GET(endpoint);
}

function fqon(org) {
    return org.properties.fqon;
}

function find_entitlement_async(base_org, resource, entitlement_name) {
    var fEnts = _GET("/" + fqon(base_org) + "/resources/" + resource.id + "/entitlements?expand=true", DO_ASYNC);
    return fEnts.thenApply(function(ents) {
        for each (e in ents) if (e.properties.action == entitlement_name) return e;
        return null;
    });
}

function contains(arr, v) {
    for each (a in arr) if (a == v) return true;
    return false;
}

function disp(r) {
    return r.name + "(" + r.id + ")"
}

function add_entitlement(base_org, resource, entitlement_name, identity, async) {
    var fEnt = find_entitlement_async(base_org, resource, entitlement_name);
    var fEntUpdate = fEnt.thenCompose(function(ent) {
        if (!ent) {
            log("could not locate entitlement " + entitlement_name + " on resource " + disp(resource));
            return java.util.concurrent.completedFuture(null);
        }
        var cur_ids = ent.properties.identities.map(function(i) {return i.id;});
        if (contains(cur_ids, identity.id)) {
            log("entitlement " + resource.name + "[" + entitlement_name + "] already contains identity " + disp(identity));
            return java.util.concurrent.completedFuture(null);
        }
        var new_ent = {
            id: ent.id,
            name: ent.name,
            properties: {
                action: ent.properties.action,
                identities: cur_ids.concat(identity.id)
            }
        };
        log("updating entitlement " + resource.name + "[" + entitlement_name + "] with " + disp(identity));
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
    });
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) return fEntUpdate;
    return fEntUpdate.get();
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
        resource_type: "event",
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
    var users = _GET("/" + fqon(parent_org) + "/users/search?name=" + username);
    if (users.length == 0) return null;
    return users[0];
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
    if (groups.length == 0) return null;
    return groups[0];
}

function delete_group(parent_org, group) {
    log("Deleting group " + fqon(parent_org) + "/" + disp(group));
    return _DELETE("/" + fqon(parent_org) + "/groups/" + group.id);
}

function add_user_to_group(parent_org, group, user) {
    log("Adding user " + user.name + " to group " + group.name);
    _PATCH("/" + fqon(parent_org) + "/groups/" + group.id + "/users?id=" + user.id);
}

function create_provider(parent_org, provider_payload) {
    log("Creating provider " + provider_payload.name);
    return _POST("/" + fqon(parent_org) + "/providers", provider_payload);
}

function find_org(fqon, async) {
    return _GET("/" + fqon, async);
}

function delete_org(org, force, async) {
    var _force = force ? force : false;
    log("Deleting org " + fqon(org));
    return _DELETE("/" + fqon(org) + "?force=" + _force, async);
}

function create_org(parent_org, name, description, async) {
    log("Creating org " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return _POST("/" + fqon(parent_org), payload, async)
}

function create_workspace(parent_org, name, description, async, f) {
    log("Creating workspace " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return _POST("/" + fqon(parent_org) + "/workspaces", payload, async, f);
}

function create_lambda(parent_org, parent_env, lambda_payload) {
    log("Creating lambda " + parent_env.name + "/" + lambda_payload.name);
    return _POST("/" + parent_org.properties.fqon + "/environments/" + parent_env.id + "/lambdas", lambda_payload);
}

function create_environment(parent_org, parent_workspace, name, description, type, async, f) {
    log("Creating environment " + parent_workspace.name + "/" + name);
    var payload = {
        description: description,
        name: name,
        properties: {
            environment_type: type
        }
    };
    return _POST("/" + parent_org.properties.fqon + "/workspaces/" + parent_workspace.id + "/environments", payload, async, f);
}

function _handleResponse(response) {
    var code = response.getStatusCode();
    var body = response.getResponseBody();
    if (code == 404) {
        return null;
    } else if (code >= 300) {
        log("WARNING: status code : " + code);
        log("response: " + body);
        throw code;
    } else if (code == 204) {
        return null;
    }
    if (response.getContentType().startsWith("application/json")) return JSON.parse(body);
    return body;
}

function _REST_JSON(method, endpoint, payload, async, fResponse) {
    var url = META.url + endpoint;
    var pc = client.prepareConnect(url)
        .setMethod(method)
        .addHeader("Authorization", META.creds);
    // log(method + " " + url);
    if (payload) {
        pc = pc.setBody(JSON.stringify(payload)).addHeader("Content-Type", "application/json")
    }
    var _async = async ? async : false; // just being explicit that the default here is 'false'
    if (_async) {
        if (!fResponse) fResponse = new CompletableFuture();
        pc.execute(new com.ning.http.client.AsyncCompletionHandler({
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
