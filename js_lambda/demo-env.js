
var META = null;


function setup_demo(args, cred) {
    META = get_meta(args, cred);
    log("found meta: " + JSON.stringify(META));

    var root_org = GET("/root");
    log("found root org:" + root_org.id);

    // find kong provider
    var kong = list_providers(root_org, ProviderTypes.APIGATEWAY)
    if (kong.length == 0)
        return "Could not find any ApiGateway providers";
    else kong = kong[0];

    // TODO: create marathon-dev in /root
    // TODO: empty root[provider.delete] and root[provider.create]

    var demo_org = create_org(root_org, "galactic-capital", "Galactic Capital Corporation");
    log("created new base org: " + demo_org.id);
    // TODO: empty root[org.create] and root[org.delete]

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

    // TODO: create group trading
    // TODO: create user jdoe
    // TODO: put jdoe in trading
    // TODO: give trading the following:
    // TODO:     - trading.galactic-capital[org.view,workspace.view]
    // TODO:     - trading-platform[environment.view]
    // TODO:     - for all envs, [lambda.all,container.all]

    var global_work = create_workspace(demo_org, "global", "global workspace");
    var global_env  = create_environment(demo_org, global_work, "global", "global environment", EnvironmentTypes.PRODUCTION);
    // TODO: create migrate lambda in "global"
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

    return "Created demo environment";
}

var EnvironmentTypes = {
    DEVELOPMENT: "development",
    PRODUCTION: "production",
    TEST: "test"
};

var ProviderTypes = {
    APIGATEWAY: "ApiGateway",
    MARATHON: "Marathon"
}

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

function get_meta(args, creds) {
    var args = JSON.parse( args );
    log("args: " + JSON.stringify(args))
    return {
        url: args.meta_url,
        creds: creds
    }
}

function log(a) {
    if (typeof(a) === 'object') console.log(JSON.stringify(a))
    else console.log(a);
}

function list_providers(org, provider_type) {
    var endpoint = "/" + org.properties.fqon + "/providers?expand=true";
    if (provider_type) endpoint = endpoint + "&type=" + provider_type;
    return GET(endpoint)
}

function create_org(parent, name, description) {
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + parent.properties.fqon, payload)
}

function create_workspace(parent_org, name, description) {
    var payload = {
        description: description,
        name: name
    };
    return POST("/" + parent_org.properties.fqon + "/workspaces", payload)
}

function create_lambda(org, env, lambda_payload) {
    return POST("/" + org.properties.fqon + "/environments/" + env.id + "/lambdas", lambda_payload);
}

function create_environment(parent_org, parent_workspace, name, description, type) {
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
    log("Response Code : " + conn.getResponseCode());
    var reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
    var result = new java.lang.StringBuilder();
    var line;
    while((line = reader.readLine()) != null) {
        result.append(line);
    }
    return JSON.parse(result.toString());
}

function GET(endpoint) {
    var url = META.url + endpoint;
    log("GET " + url);
    var conn = new java.net.URL(url).openConnection();
    conn.setDoOutput( false );
    conn.setRequestProperty("Authorization", META.creds);
    conn.setRequestMethod("GET");
    return jsonFromConn(conn);
}

function POST(endpoint, payload) {
    var url = META.url + endpoint;
    log("POST " + url);
    var conn = new java.net.URL(url).openConnection();
    conn.setDoOutput( true );
    conn.setRequestProperty("Authorization", META.creds);
    conn.setRequestMethod("POST");
    conn.setRequestProperty("Content-Type", "application/json");
    var wr = new java.io.DataOutputStream(conn.getOutputStream());
    wr.writeBytes(JSON.stringify(payload));
    wr.flush();
    wr.close();
    return jsonFromConn(conn);
}
