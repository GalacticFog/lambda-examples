
var META = null;

var LOG = new java.lang.StringBuilder();

function setup_demo(args, cred) {
    META = get_meta();
    log("found meta: " + JSON.stringify(META));

    var root_org = GET("/root");
    log("found root org:" + root_org.id);

    // find kong provider
    var kong = list_providers(root_org, ProviderTypes.APIGATEWAY);
    if (kong.length == 0)
        return "Could not find any ApiGateway providers";
    else kong = kong[0];

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
    // TODO: finish when PATCH is working
    // add_user_to_group(root_org, trading_grp, joe_the_trader);

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

    add_entitlement(demo_org,           demo_org,  "org.view", trading_grp);
    add_entitlement(equity_demo.org, trading_wrk,  "workspace.view", trading_grp);
    add_entitlement(equity_demo.org, trading_wrk,  "environment.view", trading_grp);
    add_entitlement(equity_demo.org, trading_dev,  "container.create", trading_grp);
    add_entitlement(equity_demo.org, trading_prod, "container.create", trading_grp);
    add_entitlement(equity_demo.org, trading_qa,   "container.create", trading_grp);
    add_entitlement(equity_demo.org, trading_dev,  "lambda.create", trading_grp);
    add_entitlement(equity_demo.org, trading_prod, "lambda.create", trading_grp);
    add_entitlement(equity_demo.org, trading_qa,   "lambda.create", trading_grp);

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
    var api_key = "f380eff1-fc2d-43ea-b0f9-478f59be15f3"; // get_env("API_KEY");
    var api_secret = "BGlUV7kbDMWVs4ffLFBBJNZoTG+B+ui+PmDZgSMN"; // get_env("API_SECRET");
    var login_hash = javax.xml.bind.DatatypeConverter.printBase64Binary((api_key + ":" + api_secret).getBytes());
    return {
        url: "https://meta.demo1.galacticfog.com", // get_env("META_URL"),
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
    return GET(endpoint);
}

function fqon(org) {
    return org.properties.fqon;
}

function create_group(parent_org, name, desc) {
    log("Creating group " + parent_org.name + "/" + name);
    return POST("/" + fqon(parent_org) + "/groups", {
        name: name,
        description: desc
    });
}


function find_entitlement(base_org, resource, entitlement_name) {
    var ents = GET("/" + fqon(base_org) + "/resources/" + resource.id + "/entitlements?expand=true");
    for each (e in ents) if (e.properties.action == entitlement_name) return e;
    return null;
}

function add_entitlement(base_org, resource, entitlement_name, identity) {
    var ent = find_entitlement(base_org, resource, entitlement_name);
    if (!ent) {
        log("could not locate entitlement " + entitlement_name + " on resource " + fqon(base_org) + "/" + resource.id);
        return;
    }
    log("found entitlement");
    log(ent);
    // TODO: finish
}

function create_user(parent_org, account_payload) {
    log("Creating user " + parent_org.name + "/" + account_payload.name);
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
    log("Creating org " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + fqon(parent_org), payload)
}

function create_workspace(parent_org, name, description) {
    log("Creating workspace " + parent_org.name + "/" + name);
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + fqon(parent_org) + "/workspaces", payload)
}

function create_lambda(parent_org, parent_env, lambda_payload) {
    log("Creating lambda " + parent_env.name + "/" + lambda_payload.name);
    return POST("/" + parent_org.properties.fqon + "/environments/" + parent_env.id + "/lambdas", lambda_payload);
}

function create_environment(parent_org, parent_workspace, name, description, type) {
    log("Creating environment " + parent_workspace.name + "/" + name);
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
    if (method === "PATCH") {
       // i cannot believe i have to do this in 2017...
       var delegate = sun.net.www.protocol.https.HttpsURLConnectionImpl.class.getDeclaredField("delegate");
       delegate.setAccessible(true);
       var target = delegate.get(conn);
       var f = java.net.HttpURLConnection.class.getDeclaredField("method");
       f.setAccessible(true);
       f.set(target, method);
       console.log("connection method overrideen to " + conn.getRequestMethod());
    } else {
       conn.setRequestMethod(method);
    }
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


