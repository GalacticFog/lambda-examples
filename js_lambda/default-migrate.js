function migrate(args, ctx) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/update-async/js_lambda/gestalt-sdk.js');

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(args, ctx.creds);
    log("[init] found meta: " + META.url);

    var prv_id  = args.provider_id;
    var cur_app = args.resource;

    log("Will migrate container " + disp(cur_app) + " to provider " + prv_id);

    var parent_org = find_org(args.fqon);
    var parent_env = find_environment(parent_org, args.environment_id);
    var tgt_provider = find_provider(parent_org, prv_id);
    if ( ! tgt_provider ) {
        log("ERROR: could not locate provider " + prv_id + " in org " + parent_org);
        return getLog();
    }

    var new_app;
    try {
        var op = cur_app.properties;
        var cur_num_instances = JSON.parse(op.num_instances);
        var new_net = determineTargetNetwork(cur_app, tgt_provider);
        log("new network is: " + new_net);
        new_app = create_container(parent_org, parent_env, {
            name:        cur_app.name,
            description: cur_app.description,
            properties: {
                provider: {
                    id: prv_id
                },
                num_instances:  cur_num_instances > 0 ? cur_num_instances : 1,
                cpus:           op.cpus,
                memory:         op.memory,
                disk:           op.disk,
                container_type: op.container_type,
                image:          op.image,
                network:        new_net,
                health_checks:  op.health_checks ? op.health_checks : [],
                port_mappings:  op.port_mappings ? op.port_mappings : [],
                labels:         op.labels        ? op.labels        : {},
                env:            op.env           ? op.env           : {},
                volumes :       op.volumes       ? op.volumes       : [],
                force_pull :    op.force_pull    ? op.force_pull    : false,
                constraints :   op.constraints   ? op.constraints   : [],
                accepted_resource_roles: op.accepted_resource_roles ? op.accepted_resource_roles : [],
                args :          op.args,
                cmd:            op.cmd,
                user:           op.user
            }
        });
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Created new container with id " + new_app.id);

    log("Updating ApiEndpoint targets");
    var endpoints = list_container_apiendpoints(parent_org, cur_app);
    for each (ep in endpoints) {
        try {
            update_endpoint_target(parent_org, ep, new_app);
        } catch (err) {
            log("WARNING: error updating apiendpoint: " + ep);
        }
    }

    try {
        delete_container(parent_org, parent_env, cur_app);
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Deleted old container.");

    return getLog();
}

function determineTargetNetwork(curApp, tgtProvider) {
    var curNetwork = curApp.properties.network;
    log("current app network is " + curNetwork);
    var providerNetworks = tgtProvider.properties.config.networks;
    log("target provider networks are: " + JSON.stringify(providerNetworks));
    // simple case: current container network is present in target provider available networks
    for each (n in providerNetworks) {
        log("examing provider network " + JSON.stringify(n));
        if ( !n && n.name === curNetwork ) {
            log("selected provider network " + JSON.stringify(n));
            return n.name;
        }
    }
    // next simple case: kubernetes provider doesn't care, so just return current network
    if (tgtProvider.resource_type === 'Gestalt::Configuration::Provider::CaaS::Kubernetes') return curNetwork;
    // hard case: DCOS
    if (tgtProvider.resource_type === 'Gestalt::Configuration::Provider::CaaS::DCOS') {
        // if DC/OS provider has an overlay network registered, use that
        log("looking for overlay network");
        var overlayNet = findOverlayNetwork(providerNetworks);
        if ( overlayNet ) {
            log("selected overlay network: " + overlayNet);
            return overlayNet;
        }
        // otherwise, fallback to BRIDGE networking if available
        log("looking for BRIDGE network");
        var bridgeNet = findBridgeNetwork(providerNetworks);
        if ( bridgeNet ) {
            log("selected bridge network: " + bridgeNet);
            return bridgeNet;
        }
    }
    // otherwise, throw exception
    throw "Could not determine network strategy";
}

function findOverlayNetwork(networks) {
    for each (n in networks) if (n.name != 'BRIDGE' && n.name != 'HOST') return n.name;
    return null;
}

function findBridgeNetwork(networks) {
    for each (n in networks) if (n.name === 'BRIDGE') return n.name;
    return null;
}

function list_container_apiendpoints(org, container) {
    var endpoint = "/" + fqon(org) + "/containers/" + container.id + "/apiendpoints?expand=true";
    return _GET(endpoint);
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
