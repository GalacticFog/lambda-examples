function migrate(args, ctx) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/update-async/js_lambda/gestalt-sdk.js');

    args = JSON.parse( args );
    ctx  = JSON.parse( ctx );

    META = get_meta(args, ctx.creds);
    log("[init] found meta: " + META.url);

    var prv_id   = args.provider_id;
    var cur_cntr = args.resource;

    log("Will migrate container " + disp(cur_cntr) + " to provider " + prv_id);

    var parent_org = find_org(args.fqon);
    var parent_env = find_environment(parent_org, args.environment_id);
    var tgt_provider = find_provider(parent_org, prv_id);
    if ( ! tgt_provider ) {
        log("ERROR: could not locate provider " + prv_id + " in org " + parent_org);
        return getLog();
    }

    var new_cntr;
    try {
        var op = cur_cntr.properties;
        var cur_num_instances = JSON.parse(op.num_instances);
        var new_net = determineTargetNetwork(cur_cntr, tgt_provider);
        new_cntr = create_container(parent_org, parent_env, {
            name:        cur_cntr.name,
            description: cur_cntr.description,
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
    log("Created new container with id " + new_cntr.id);

    try {
        delete_container(parent_org, parent_env, cur_cntr);
    } catch(err) {
        log("ERROR: error creating container: response code " + err);
        return getLog();
    }
    log("Deleted old container.");

    return getLog();
}

function determineTargetNetwork(curCntr, tgtProvider) {
    var curNetwork = curCntr.properties.network;
    var providerNetworks = tgtProvider.properties.networks;
    // simple case: current container network is present in target provider available networks
    for each (n in providerNetworks) if ( !n && n.name == curNetwork ) return n.name;
    // next simple case: kubernetes provider doesn't care, so just return current network
    if (tgtProvider.resource_type === 'Gestalt::Configuration::Provider::CaaS::Kubernetes') return curNetwork;
    // hard case: DCOS
    if (tgtProvider.resource_type === 'Gestalt::Configuration::Provider::CaaS::DCOS') {
        // if DC/OS provider has an overlay network registered, use that
        var overlayNet = findOverlayNetwork(providerNetworks);
        if ( !overlayNet ) return overlayNet;
        // otherwise, fallback to BRIDGE networking if available
        var bridgeNet = findBridgeNetwork(providerNetworks);
        if ( !bridgeNet ) return bridgeNet;
    }
    // otherwise, throw exception
    throw "Could not determine network strategy";
}

function findOverlayNetwork(networks) {
    for each (n in networks) if (n.name != 'BRIDGE' && n.name != 'HOST') return n.name;
}

function findBridgeNetwork(networks) {
    for each (n in networks) if (n.name === 'BRIDGE') return n.name;
}
