var util = require('util');
var EventEmitter = require('events').EventEmitter;
var WebSocket = require('ws');
var SimplePeer = require('simple-peer');
var randomstring = require('randomstring').generate;

var Client = module.exports = function(uri, opts, cb) {
  var self = this;
  if(typeof uri === 'object') {
    opts = uri;
    uri = opts.uri;
  } else if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  if(!uri) throw new Error('must specify a URI');
  this.opts = opts;
  this.uri = uri;

  this.pendingPeers = {};

  this.handlers = new EventEmitter;
  this.handlers.once('init', function(data) {
    self.id = data.id;
    self.emit('initialized', data);
  });
  this.handlers.on('signal', this.onSignal.bind(this));

  if(cb) this.on('initialized', cb);
  this.conn = new WebSocket('ws://'+this.uri);
  this.conn.on('open', function() { self.emit('connect'); });
  this.conn.on('message', this.onMessage.bind(this));
};
util.inherits(Client, EventEmitter);

Client.prototype.onMessage = function(raw) {
  var data;
  try { data = JSON.parse(raw); }
  catch(err) { return this.conn.close(); }
  if(!data.event) return this.conn.close();

  if(this.opts.debug || this.opts.verbose)
    console.log('received "'+data.event+'" message');
  if(this.opts.debug)
    console.log(raw);

  this.handlers.emit(data.event, data);
};

Client.prototype.discover = function(n, cb) {
  var self = this;

  if(typeof n === 'function') {
    cb = n;
    n = 20;
  }

  var reqId;
  if(cb) {
    reqId = randomstring(8);
    this.handlers.once('peers:'+reqId, function(res) {
      cb(null, res.peers);
    });
  }
  this.conn.send(JSON.stringify({ event: 'peers', reqId: reqId, n: n }));
};

Client.prototype.accept = function(onConnect) {
  this.accepting = true;
  if(onConnect) this.on('incomingConnection', onConnect);
  this.conn.send(JSON.stringify({ event: 'announce' }));
};

Client.prototype.connect = function(peerId, cb) {
  var self = this;
  if(this.pendingPeers[peerId]) return;
  var peer = this.pendingPeers[peerId] = new SimplePeer({ initiator: true, wrtc: require('wrtc') });
  peer.on('signal', function(signalData) {
    self.conn.send(JSON.stringify({ event: 'signal', to: peerId, signal: signalData }));
  });
  peer.on('connect', function() {
    self.onPeerConnect(peerId);
    if(cb) cb(null, peer);
  });
};

Client.prototype.onSignal = function(data) {
  var self = this;
  var peer = this.pendingPeers[data.from];
  if(!peer) {
    if(!this.accepting) return;

    this.emit('signal', data);

    peer = this.pendingPeers[data.from] = new SimplePeer({ wrtc: require('wrtc') });
    peer.on('signal', function(signalData) {
      self.conn.send(JSON.stringify({
        event: 'signal',
        to: data.from,
        signal: signalData
      }));
    });
    peer.on('connect', function() {
      self.onPeerConnect(data.from);
      self.emit('incomingConnection', data.from, peer);
    });
  }
  peer.signal(data.signal);
};

Client.prototype.onPeerConnect = function(peerId) {
  var peer = this.pendingPeers[peerId];
  delete this.pendingPeers[peerId];
  this.emit('connection', peerId, peer);
};
