function migrate(args, creds) {

    load('https://raw.githubusercontent.com/GalacticFog/lambda-examples/update-async/js_lambda/gestalt-sdk.js');

    var args = JSON.parse( args );

    META = get_meta(args, creds);
    log("[init] found meta: " + META.url);

    var prv_id   = args.provider_id;
    var cur_cntr = args.resource;

    log("Will migrate container " + disp(cur_cntr) + " to provider " + prv_id);

    var parent_org = find_org(args.fqon);
    var parent_env = find_environment(parent_org, args.environment_id);

    try {
        var op = cur_cntr.properties;
        var cur_num_instances = JSON.parse(op.num_instances);
        var new_cntr = create_container(parent_org, parent_env, {
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
                network:        op.network,
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
