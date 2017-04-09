var app = require('express')();
var http = require('http').Server(app);
// Base socket.io on express app
var io = require('socket.io')(http);
// Constanize the port number
var port = process.env.PORT || 8080;
// Connection with api.ai
var apiai = require('apiai');
var appAPIAI = apiai("ecc353311a954139b3ff036c8f6eb2ae");

// Initialize the front-end
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// Detect any connection
io.on('connection', function(socket){
  console.log("Connected");

  // Waiting for the start of the speech recognition
  socket.on('annyang', function(msg){
    console.log("annyang: " + msg);
  });

  // Send the userInput to api.ai when notified by front-end
  socket.on('send_to_apiai', function(msg){
    console.log("Send to api.ai: " + msg);

    // Send request to api.ai
    var request = appAPIAI.textRequest(msg, {
      sessionId: '001'
    });

    // Waiting for the response from api.ai
    request.on('response', function(response) {
      var sysOutput = response.result.fulfillment.speech;
      console.log(sysOutput);

      // Notify the front-end along with the response from api.ai
      socket.emit("response_from_apiai",sysOutput);
    });

    request.on('error', function(error) {
      console.log(error);
    });
     
    request.end();

  });



});

// Listening on the port
http.listen(port, function(){
  console.log('listening on *:' + port);
});