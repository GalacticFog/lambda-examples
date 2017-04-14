function run(/* arguments, credentials */) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/update-async/js_lambda/gestalt-sdk.js');

    META = get_meta();
    log("found meta: " + META.url, LoggingLevels.DEBUG);

    var root_org = find_org("root");
    log("found root org:" + root_org.id + "\n", LoggingLevels.DEBUG);

    // find kong provider
    var laser = list_providers(root_org, ProviderTypes.LAMBDA);
    if (laser.length == 0) {
        log("error: Could not find any Lambda providers");
        return getLog();
    }
    else laser = laser[0];
    log("")

    try {
        var trading_grp = create_group(root_org, "trading", "Trading group");
    } catch(err) {
        if (err == 409) {
            log("group 'trading' already existed");
            return getLog();
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
            return getLog();
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

    add_entitlements(demo_org,  demo_org,     "org.view",         trading_grp, DO_ASYNC);
    add_entitlements(equityDiv, trading_wrk,  "workspace.view",   trading_grp, DO_ASYNC);
    add_entitlements(equityDiv, trading_wrk,  "environment.view", trading_grp, DO_ASYNC);
    var ENV_ENTS = ["container.create", "container.view", "container.update", "container.delete", "container.scale", "container.migrate",
                    "lambda.create", "lambda.view", "lambda.update", "lambda.delete"];
    for each (env in [trading_dev, trading_prod, trading_qa]) {
        add_entitlements(equityDiv, env, ENV_ENTS, trading_grp, DO_ASYNC);
    }

    log("")
    var global_work = create_workspace(demo_org, "global", "global workspace");
    var global_env  = create_environment(demo_org, global_work, "global", "global environment", EnvironmentTypes.PRODUCTION);
    var migrate_lambda = create_lambda(demo_org, global_env, {
        description: "",
        name: "default-migrate",
        properties: {
            code_type: "package",
            compressed: false,
            cpus: 0.2,
            env: {},
            handler: "default-migrate;migrate",
            headers: {
                Accept: "text/plain"
            },
            memory: 512,
            package_url: "https://raw.githubusercontent.com/GalacticFog/lambda-examples/1.0.1/js_lambda/default-migrate.js",
            periodic_info: {
                payload: {}
            },
            provider: {
                id: laser.id,
                locations: []
            },
            public: true,
            runtime: "nodejs",
            timeout: 120
        }
    });
    log("\ncreated migrate lambda: " + migrate_lambda.id);
    create_migrate_policy(equityDiv, equityDemo.fDev.get(),  migrate_lambda);
    create_migrate_policy(equityDiv, equityDemo.fProd.get(), migrate_lambda);
    create_migrate_policy(equityDiv, equityDemo.fQA.get(),   migrate_lambda);

    log("\nDemo environment complete.")
    return getLog();
}

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
