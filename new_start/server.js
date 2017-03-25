var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//var request = require('request');

// Routes
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});


io.on('connection', function(socket){
  console.log("connected");
  
  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
  });
});


// Start the server
app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})