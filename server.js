var express = require('express');
var app = express();
var http = require('http').Server(app);
// Base socket.io on express app
var io = require('socket.io')(http);
// Constanize the port number
var port = process.env.PORT || 8080;
// Dialog Manager
var apiai = require('apiai');


// Global Initialization
var TOKEN_DemoAgent = "ecc353311a954139b3ff036c8f6eb2ae";
var TOKEN_ServerTest = "8010c7fae89f4faeb8fe10470ae77742";


var user_data = {}

// Build up the routers
require('./app/routes.js')(app);

// Detect any connection
io.on('connection', function(socket){

  // Get the client's connection port
  var portNum = socket.request.connection.remotePort
  console.log("Connection on port" + portNum);
  
  // Waiting for the start of the speech recognition
  socket.on('annyang', function(msg){
    console.log("annyang: " + msg);
  });

  // Send the userInput to api.ai when notified by front-end
  socket.on('send_to_apiai', function(arr){
    // Extract parameters
    msg = arr[0];
    isConnectToDemoAgent = arr[1];
    console.log("Agent Switched: Connect to DemoAgent? " + isConnectToDemoAgent);

    console.log("Send to api.ai: " + msg);


    // Connection with api.ai
    var appAPIAI;
    
    if (isConnectToDemoAgent){
      appAPIAI = apiai(TOKEN_DemoAgent);
      console.log("DemoAgent connected");
    }
    else {
      appAPIAI = apiai(TOKEN_ServerTest);
      console.log("ServerTest connected");
    }

    // Send request to api.ai
    var request = appAPIAI.textRequest(msg, {
      sessionId: portNum
    });

    //initailize user
    user_data[portNum] = 
    { 'restaurant_style':null,
      'restaurant_price':100  };
    user_data[portNum]['recommend_restaurant'] = new Set()

    // Waiting for the response from api.ai
    request.on('response', function(response) {
      var sysOutput = response.result.fulfillment.speech;
      console.log(sysOutput);
      var action =  response.result.action;
      sysOutput = eval_function(action, sysOutput, portNum);
      
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

// Initialize the front-end
app.use(express.static("public"));

function eval_function(action, response, portNum){
  switch(action){
    case "recommend_restaurant":
      var priceRequest = response.result.parameters["unit-currency"];
      var styleRequest = response.result.parameters["restaurant_style"];
      //update parameter if the response is not empty
      if(priceRequest.length) user_data[portNum]['restaurant_price'] = priceRequest;
      if(priceRequest.length) user_data[portNum]['restaurant_style'] = styleRequest;
      console.log(user_data); 

      //read restaurant csv file
      d3.csv("/restaurant.csv", function(data) {
        var currentPrice = 0;
        var currentRestaurant = null;
        styleRequest = user_data[portNum]['restaurant_style'];

        if(data){
          //loop over each row of data
          data.forEach(function(row) {
            //if the restaurant has not recommended yet
            if(!user_data[portNum]['recommend_restaurant'].has( row.name )){
              var price = row.price;
              //we want to match the restaurant whose price is the closest to the price request
              if(price < parseInt(priceRequest) && price >currentPrice && row.style == styleRequest){
                currentPrice = price;
                currentRestaurant = row.name;

              }
            }
          });
          //no restaurant found
          if(currentRestaurant == null){

          }
          //add current restaurant to the set so the you don't duplicate recommendation
          user_data[portNum]['recommend_restaurant'].add(currentRestaurant);

        }
        else{
          console.log("no data");   
        }
        
      });
      break;
  }
  return response
}