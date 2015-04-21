var http = require('http');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var corsify = require('corsify');
var randomstring = require('randomstring').generate;
var shuffle = require('array-shuffle');
var WebSocketServer = require('ws').Server;
var pkg = require('./package');

var Server = module.exports = function(opts) {
  var self = this;
  self.opts = opts || {};

  self.server = http.createServer(corsify(function(req, res) {
    res.end(JSON.stringify({
      name: pkg.name,
      version: pkg.version,
      peers: self.peers.public.length
    }));
  }));

  self.peers = {
    public: {},
    all: {}
  };

  self.handlers = new EventEmitter;
  self.handlers.on('peers', self.getPeers.bind(self));
  self.handlers.on('signal', self.sendSignal.bind(self));
  self.handlers.on('announce', self.announce.bind(self));
};
util.inherits(Server, EventEmitter);

Server.prototype.listen = function(port, hostname, cb) {
  var self = this;

  if(typeof port === 'function') {
    cb = port;
    port = null;
  } else if(typeof hostname === 'function') {
    cb = hostname;
    hostname = null;
  }
  self.port = port || 8192;
  self.hostname = hostname || '0.0.0.0';
  if(cb) self.on('listening', cb);

  self.wss = new WebSocketServer({ server: self.server });
  self.wss.on('connection', self.onConnect.bind(self));
  self.server.listen(self.port, self.hostname, function() {
    self.emit('listening');
  });
};

Server.prototype.onConnect = function(conn) {
  var self = this;

  var id;
  while(!id || self.peers.all[id]) id = randomstring(10);
  var client = self.peers.all[id] = { id: id, conn: conn };
  conn.send(JSON.stringify({ event: 'init', id: id }));

  conn.on('message', function(raw) {
    var data;
    try { data = JSON.parse(raw); }
    catch(err) { return conn.close(); }
    if(!data.event) return conn.close();

    if(self.opts.debug || self.opts.verbose)
      console.log('received "'+data.event+'" message from '+id);
    if(self.opts.debug)
      console.log(raw);

    self.handlers.emit(data.event, client, data);
  });

  self.emit('connection', client);
};

Server.prototype.getPeers = function(client, req) {
  var n = req.n || 20;
  var ids = [];
  for(var id in this.peers) ids.push(id);
  ids = shuffle(ids).slice(0, n);
  client.conn.send(JSON.stringify({ event: 'peers', peers: ids }));
};

Server.prototype.sendSignal = function(client, req) {
  var peer = this.peers.all[req.to];
  if(!peer) return;
  peer.conn.send(JSON.stringify({ event: 'signal', from: client.id, signal: req.signal }));
};

Server.prototype.announce = function(client, req) {
  var self = this;
  if(self.peers.public[client.id]) return;

  self.peers.public[client.id] = client;
  if(self.opts.verbose) console.log('added public peer:', client.id);
  // TODO: periodically ping client, and ensure it is a sane node

  client.conn.on('close', function() {
    delete self.peers.public[client.id];
    if(self.opts.verbose) console.log('removed public peer:', client.id);
  });
};
