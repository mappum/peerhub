#!/usr/bin/env node

var Client = require('../client.js');
// connect to a seed server at localhost
var client = new Client('localhost:8192', function() {
  console.log('connected to seed server:', client.uri);

  client.on('connection', function(id, peer) {
    // this callback is called whenever a peer connection is established
    // (both incoming and outgoing)
    peer.on('close', function() {
      console.log('disconnected from peer', id);
    });

    // periodically send heartbeats
    setInterval(function() {
      peer.send('\n\n');
    }, 2500);
  });

  // tell the server we want to publicly list our node for incoming connections
  client.accept(function(id, peer) {
    // this callback is called whenever an incoming peer connection is established
    console.log('accepted incoming connection from', id);
  });

  // get a list of available peers that we can connect to
  client.discover(function(err, peers) {
    if(err) return console.error(err);
    console.log('got list of available peers:', peers);

    // connect to peers returned by server
    peers.forEach(function(peerId) {
      if(peerId === client.id) return;
      client.connect(peerId, function(err, peer) {
        if(err) return console.error(err);
        console.log('connected to peer', peerId);
      })
    });
  });
});
