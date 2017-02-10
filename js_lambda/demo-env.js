
var META = null;

var LOG = new java.lang.StringBuilder();

function setup_demo(args, cred) {
    log("env: " + java.lang.System.getenv().toString());
    META = get_meta();
    log("found meta: " + JSON.stringify(META));

    var root_org = GET("/root");
    log("found root org:" + root_org.id);

    // find kong provider
    var kong = list_providers(root_org, ProviderTypes.APIGATEWAY)
    if (kong.length == 0)
        return "Could not find any ApiGateway providers";
    else kong = kong[0];

    try {
        var demo_org = create_org(root_org, "galactic-capital", "Galactic Capital Corporation");
    } catch(code) {
        if (code == 409) return "Org already exists; delete it and then try again.";
        else return "Code " + code + " on attempt to create new org.";
    }
    // TODO: empty root[org.create] and root[org.delete]

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
    // TODO: empty root[provider.delete] and root[provider.create]

    // TODO: set galactic-capital[org.create]
    // create and populate demo orgs: hr, it, debt, equity, private-client
    // - each gets workspace ${name}-platform
    // - each platform gets environments dev,qa,prod
    var hr_demo     = populate_demo_org("hr", "HR Division", demo_org);
    var it_demo     = populate_demo_org("it", "IT Division", demo_org);
    var debt_demo   = populate_demo_org("debt", "Debt Division", demo_org);
    var equity_demo = populate_demo_org("equity", "Equity Division", demo_org);
    var pc_demo     = populate_demo_org("private-client", "Private Client Division", demo_org);
    // - additionally, equity.galactic-capital gets workspace "trading"
    var trading_wrk  = create_workspace(equity_demo.org, "trading", "Trading application platform");
    var trading_dev  = create_environment(equity_demo.org, trading_wrk, "dev", "Development", EnvironmentTypes.DEVELOPMENT);
    var trading_prod = create_environment(equity_demo.org, trading_wrk, "prod", "Production", EnvironmentTypes.PRODUCTION);
    var trading_qa   = create_environment(equity_demo.org, trading_wrk, "qa", "QA", EnvironmentTypes.TEST);

    var trading_grp = create_group(root_org, "trading", "Trading group");
    var joe_the_trader = create_user(root_org, {
        description: "Principal Engineer/Trading group",
        name: "jdoe",
        properties: {
            email: "jdoe@galacticfog.com",
            firstName: "J",
            gestalt_home: "galactic-capital",
            lastName: "Doe",
            password: "joethetrader",
            phoneNumber: "+15555555555"
        }
    });
    add_user_to_group(root_org, trading_grp, joe_the_trader);

    // TODO: give trading the following:
    // TODO:     - trading.galactic-capital[org.view,workspace.view]
    // TODO:     - trading-platform[environment.view]
    // TODO:     - for all envs, [lambda.all,container.all]

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
                    locations: []
                }
            ],
            public: true,
            runtime: "nodejs",
            synchronous: false,
            timeout: 120
        }
    });
    log("created migrate lambda: " + migrate_lambda.id);
    // TODO: create migration policy in all three environments in equity-platform

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

function populate_demo_org(name, description, base_org) {
    var new_org = create_org(base_org, name, description);
    var new_wrk = create_workspace(new_org, name+"-platform", description + " application platform");
    var dev     = create_environment(new_org, new_wrk, "dev",  "Development", EnvironmentTypes.DEVELOPMENT);
    var prod    = create_environment(new_org, new_wrk, "prod", "Production",  EnvironmentTypes.PRODUCTION);
    var qa      = create_environment(new_org, new_wrk, "qa",   "QA",          EnvironmentTypes.TEST);

    return {
        org: new_org,
        workspace: new_wrk,
        dev: dev,
        prod: prod,
        qa: qa
    }
}

function get_env(key) {
    var val = java.lang.System.getenv().get(key);
    if (!val) throw "Env missing variable " + key;
    return val;
}

function get_meta(args, creds) {
    // TODO: fix these when vars are working again
    var api_key = "83580c51-c44a-47b3-8dc5-09b2c6cef924"; // get_env("API_KEY");
    var api_secret = "cCtJ3H4WCK7jPCOBpQTggLDzFbkePSC71VwIEfb+"; // get_env("API_SECRET");
    var prehash = api_key + ":" + api_secret;
    var hash = new java.lang.String(java.util.Base64.getEncoder().encode(prehash.getBytes()));
    return {
        url: "https://meta.demo1.galacticfog.com", // get_env("META_URL"),
        creds: "Basic " + hash
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
    LOG.append(str);
}

function list_providers(org, provider_type) {
    var endpoint = "/" + org.properties.fqon + "/providers?expand=true";
    if (provider_type) endpoint = endpoint + "&type=" + provider_type;
    return GET(endpoint)
}

function fqon(org) {
    return org.properties.fqon;
}

function create_group(parent_org, name, desc) {
    log("Creating group " + name);
    return POST("/" + fqon(parent_org) + "/groups", {
        name: name,
        description: desc
    });
}

function create_user(parent_org, account_payload) {
    log("Creating user " + account_payload.name);
    return POST("/" + fqon(parent_org) + "/users", account_payload);
}

function add_user_to_group(parent_org, group, user) {
    log("Adding user " + user.name + " to group " + group.name);
    PATCH("/" + fqon(parent_org) + "/groups/" + group.id + "/users?id=" + user.id);
}

function create_provider(parent_org, provider_payload) {
    log("Creating provider " + provider_payload.name);
    return POST("/" + fqon(parent_org) + "/providers", provider_payload);
}

function create_org(parent_org, name, description) {
    log("Creating org " + name);
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + fqon(parent_org), payload)
}

function create_workspace(parent_org, name, description) {
    log("Creating workspace " + name);
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + fqon(parent_org) + "/workspaces", payload)
}

function create_lambda(parent_org, parent_env, lambda_payload) {
    log("Creating lambda " + lambda_payload.name);
    return POST("/" + parent_org.properties.fqon + "/environments/" + parent_env.id + "/lambdas", lambda_payload);
}

function create_environment(parent_org, parent_workspace, name, description, type) {
    log("Creating environment " + name);
    var payload = {
        description: description,
        name: name,
        properties: {
            environment_type: type
        }
    };
    return POST("/" + parent_org.properties.fqon + "/workspaces/" + parent_workspace.id + "/environments", payload)
}

function jsonFromConn(conn) {
    var code = conn.getResponseCode();
    if (code >= 300) {
        log("WARNING: response code : " + code);
        throw code;
    }
    var reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
    var result = new java.lang.StringBuilder();
    var line;
    while((line = reader.readLine()) != null) {
        result.append(line);
    }
    return JSON.parse(result.toString());
}

function REST_JSON(method, endpoint, payload) {
    var url = META.url + endpoint;
    // log(method + " " + url);
    var conn = new java.net.URL(url).openConnection();
    conn.setRequestProperty("Authorization", META.creds);
    conn.method = method;
    //if (method === "PATCH") {
    //    // i cannot believe i have to do this in 2017
    //    conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
    //    conn.setRequestMethod("POST");
    //} else {
    //    conn.setRequestMethod(method);
    //}
    if (payload) {
        conn.setDoOutput( true );
        conn.setRequestProperty("Content-Type", "application/json");
        var wr = new java.io.DataOutputStream(conn.getOutputStream());
        wr.writeBytes(JSON.stringify(payload));
        wr.flush();
        wr.close();
    } else {
        conn.setDoOutput( false );
    }
    return jsonFromConn(conn);
}

function GET(endpoint) {
    return REST_JSON("GET", endpoint);
}

function POST(endpoint, payload) {
    return REST_JSON("POST", endpoint, payload);
}

function PATCH(endpoint, payload) {
    return REST_JSON("PATCH", endpoint, payload);
}


