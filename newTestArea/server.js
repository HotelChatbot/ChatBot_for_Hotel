var express = require('express');
var app = express();
//var http = require('http').Server(app);
//var io = require('socket.io')(http);

//var request = require('request');

// Routes
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
})

/*
io.on('connection', function(socket){
  console.log('a user connected');
});
*/

// Start the server
app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})