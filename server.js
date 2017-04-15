var express = require('express');
var app = express();
var http = require('http').Server(app);
// Base socket.io on express app
var io = require('socket.io')(http);
// Constanize the port number
var port = process.env.PORT || 80;

// read csv file
var d3 = require('d3');

// Use mongoose to manipulate mongoDB
var mongoose = require('mongoose');
// Load the database config
var database = require('./config/database');

// Parse the request body
var bodyParser = require('body-parser');

// Dialog Manager
var apiai = require('apiai');

// Global Initialization
var TOKEN_DemoAgent = "ecc353311a954139b3ff036c8f6eb2ae";
var TOKEN_ServerTest = "8010c7fae89f4faeb8fe10470ae77742";


// Connect to database with specification
if (process.env.PORT) {
  mongoose.connect(database.remoteUrl);
} else {
  mongoose.connect(database.localUrl);
}

// Initialize the front-end
app.use(express.static("public"));


// Enable auto parsing the request body
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json()); 
// parse application/vnd.api+json as json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); 

var user_data = {};
var restaurant_data = [];

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

    //if user has not been initailized
    if(!user_data[portNum]){
      //initailize user
      user_data[portNum] = 
      { 'restaurant_style':"",
        'restaurant_price':"",
        'restaurant_name': ""
      };
      user_data[portNum]['recommend_restaurant'] = new Set()  
    }
    

    // Waiting for the response from api.ai
    request.on('response', function(response) {
      var sysOutput = response.result.fulfillment.speech;
      console.log(sysOutput);
      var action =  response.result.action;
      //perform action if needed
      if(action.length > 0) {
        console.log("action",action);
        sysOutput = eval_function(action, response, portNum);
        console.log(sysOutput)
      }
      
      
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
  //read db into server
  read_csv();


});

function eval_function(action, response, portNum){
  switch(action){
    case "recommend_restaurant":
      response = recommend_restaurant(response,portNum);
      break;
    case "restaurant_give_detail":
      response =  restaurant_give_detail(response,portNum);
      break;
  }
  console.log("eval_function");
  return response
}



function recommend_restaurant(response, portNum){
  //console.log(response.result);
  var priceRequest = response.result.parameters['unit-currency'];
  var styleRequest = response.result.parameters["restaurant_style"];
   
  //update parameter if the response is not empty
  if(priceRequest.length > 0) user_data[portNum]['restaurant_price'] = priceRequest;
  if(styleRequest.length > 0) user_data[portNum]['restaurant_style'] = styleRequest;
  
  var currentPrice = "";
  var currentRestaurant = "";
  //read restaurant csv file
  
  // console.log('styleRequest', styleRequest);
  restaurant_data.forEach(function(restaurant){
    var name = restaurant.name;
    var price = restaurant.price;
    var style = restaurant.style;
    var location = restaurant.location;
    //if the restaurant has not recommended yet
    if(!user_data[portNum]['recommend_restaurant'].has( name )){

      //we want to match the restaurant whose price is the closest to the price request
      
      if( style == styleRequest){
        
        if(priceRequest.length == 0 || (parseInt(price) < parseInt(priceRequest) && parseInt(price) >currentPrice)){
          currentPrice = parseInt(price);
          currentRestaurant = name;
           
        }
      }
    }
  });
  console.log("currentRestaurant", currentRestaurant);
  //no restaurant found
  if(!currentRestaurant){
    //might need to come up with a way to recommend user restaurant with another style
    //might need to reset context here
    console.log("No restaurant");
    response = "Sorry we cannot find any restaurant that meets your criteria. What kind of restaurant do you like";
    
    
  }
  else{
    //add current restaurant to the set so that you don't duplicate recommendation
    user_data[portNum]['recommend_restaurant'].add(currentRestaurant);
    //update current user's data
    user_data[portNum]['restaurant_style'] = styleRequest;
    user_data[portNum]['restaurant_name'] = currentRestaurant;
    user_data[portNum]['restaurant_price'] = priceRequest;
    console.log(user_data);
    //concatenate data into response
    response = "Here is a "+ styleRequest + " restaurant called " + currentRestaurant +" that costs around " +currentPrice;  
  }
  
  
  return response;
}

function restaurant_give_detail(response, portNum){
  console.log(user_data);
  restaurant_data.forEach(function(restaurant){
    var name = restaurant.name;
    var price = restaurant.price;
    var style = restaurant.style;
    var location = restaurant.location;
    //if the restaurant has not recommended yet
    if(name == user_data[portNum]['restaurant_name']){

        response = "the restaurant is located at " + location + "and it costs you around "+ price;
    }
    
      
      
      
    
  });
  
  return response;
}

function parse_price(unit_currency){
  //check if unit_currency is an object
  if(typeof(unit_currency) == "object"){
    return unit_currency.currency;
  }
  else return unit_currency;
}

function read_csv(){
  d3.csv("/restaurant.csv", function(data) {
    if(data){
      //console.log(data);
      var i=0;
      data.forEach(function(row) {
        var restaurant_name = row.name;
        var restaurant_stlye = row.style;
        var price = row.price;
        var location = row.location;
        
        
        restaurant = {
          'name': restaurant_name,
          'style': restaurant_stlye,
          'price': price,
          'location': location
        }
        restaurant_data.push(restaurant);    
      });  
    }
   console.log(restaurant_data);
  });
}

