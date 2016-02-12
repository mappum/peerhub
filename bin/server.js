#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var Server = require('../server.js');

var verbose = true;
if(argv.verbose != null) verbose = argv.verbose;
else if(argv.v != null) verbose = argv.v;

var server = new Server({
  verbose: verbose,
  debug: argv.d || argv.debug
});

var port = argv.port || argv.p || process.env.PORT;
var hostname = argv.hostname || argv.h;
server.listen(port, hostname, function() {
  if(verbose)
    console.log('seed server listening on ' + server.hostname + ':' + server.port);
});
