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
var room_facility_data = [];
var hotel_facility_data = [];

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
        'restaurant_name': "",
        'last_inquired_facility' : ""
      };
      user_data[portNum]['recommend_restaurant'] = new Set() ;
      //current requested price range
      user_data[portNum]['restaurant_price_request'] = ['<', '1000'];
    }
    

    // Waiting for the response from api.ai
    request.on('response', function(response) {
      var sysOutput = response.result.fulfillment.speech;
      console.log(sysOutput);
      var action =  response.result.action;
      //perform action if needed
      if(action.length > 0) {
        console.log("action",action);
        //decide ouput by evaluating the action
        sysOutput = eval_action(action, response, portNum);
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
  //read db into server when ready
  read_csv();


});


//evalate action and determine system response
function eval_action(action, response, portNum){
  switch(action){
    case "recommend_restaurant":
    case "recommend_another_restaurant":
      response = recommend_restaurant(response,portNum);
      break;
    case "restaurant_give_detail":
      response =  restaurant_give_detail(response,portNum);
      break;
    case "restaurant_check_price":
      response = restaurant_check_price(response, portNum);
      break;
    case "restaurant_price_switch":
      response = restaurant_price_switch(response, portNum);
      break;
    case "restaurant_style_switch":
      response = restaurant_style_switch(response, portNum);
      break;
    case "inquire_hotel_facility":
      response = inquire_hotel_facility(response, portNum);
      break;
    case "inquire_room_facility":
      response = inquire_room_facility(response, portNum);
      break;
  }   
  
  return response
}


//basic recommend_restaurant function
function recommend_restaurant(response, portNum){
  //extract user request from the JSON response
  var priceRequest = "";
  var styleRequest = "";
  if( 'unit-currency' in response.result.parameters){
    priceRequest = parse_price(response.result.parameters['unit-currency']);  
  }
  if('restaurant_style' in response.result.parameters){
    styleRequest = response.result.parameters["restaurant_style"];
  }
   
  
  //update parameter if the response is not empty
  if(priceRequest && priceRequest.length > 0){
    user_data[portNum]['restaurant_price_request'][0] = '<';
    user_data[portNum]['restaurant_price_request'][1] = priceRequest;

  } else{
    priceRequest = user_data[portNum]['restaurant_price_request'][1];
  }
  if(styleRequest && styleRequest.length > 0) {
    user_data[portNum]['restaurant_style'] = styleRequest;
  }
  else{
    styleRequest = user_data[portNum]['restaurant_style'];
  }
  console.log("priceRequest",priceRequest);
  console.log("styleRequest",styleRequest);

  //initialize variables for the later loop
  var currentPrice = "";
  var currentRestaurant = "";
  
  
  
  restaurant_data.forEach(function(restaurant){
    var name = restaurant.name;
    var price = restaurant.price;
    var style = restaurant.style;
    var location = restaurant.location;
    //if the restaurant has not been recommended yet
    if(!user_data[portNum]['recommend_restaurant'].has( name )){

      //if the style match the style request
      if( style == user_data[portNum]['restaurant_style']){
        //if user request 
        if((parseInt(price) <= parseInt(priceRequest) &&user_data[portNum]['restaurant_price_request'][0] == '<') ||
          (parseInt(price) >= parseInt(priceRequest) &&user_data[portNum]['restaurant_price_request'][0] == '>')){
          currentRestaurant = name;
          //update current user's data
          user_data[portNum]['restaurant_price'] = price;
          user_data[portNum]['restaurant_name'] = currentRestaurant;
          
           
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
    //if user did not specify restaurant style
    if(styleRequest==""){
      response = "What kind of restaurant do you like?";  
    }
    else{
      response = "Sorry we cannot find any restaurant that meets your criteria. What kind of restaurant do you like";  
    }
    
    
    
  }
  else{
    //add current restaurant to the set so that you don't duplicate recommendation
    user_data[portNum]['recommend_restaurant'].add(currentRestaurant);
    
    console.log(user_data);
    //concatenate data into response
    response = "Here is a "+ user_data[portNum]['restaurant_style'] + " restaurant called " + currentRestaurant +" that costs around " +user_data[portNum]['restaurant_price'];  
  }
  
  
  return response;
}

//provide user information about the restaurant
function restaurant_give_detail(response, portNum){
  //get user's request from JSON response
  var priceRequest = parse_price(response.result.parameters['unit-currency']);
  
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

//provide user price of the restaurant
function restaurant_check_price(response, portNum){
  //get user's request from JSON response
  var priceRequest = parse_price(user_data[portNum]['restaurant_price']);
  
  restaurant_data.forEach(function(restaurant){
    var name = restaurant.name;
    var price = restaurant.price;
    var style = restaurant.style;
    var location = restaurant.location;
    //if the restaurant has not recommended yet
    if(name == user_data[portNum]['restaurant_name']){

        response = "the restaurant costs you around "+ price;
    }   
    
  });
  return response;
}

//request a resturant with different price range
function restaurant_price_switch(response, portNum){
  //get user's request from JSON response
  var priceRequest = response.result.parameters["price_request"];
  
  if( priceRequest=="lower" ){

    user_data[portNum]['restaurant_price_request'][0] == '<';
    //to string
    user_data[portNum]['restaurant_price_request'][1] = (parseInt(user_data[portNum]['restaurant_price']) -1) + '' ;
  }
  else{
    user_data[portNum]['restaurant_price_request'][0] == '>';
    //to string
    user_data[portNum]['restaurant_price_request'][1] = (parseInt(user_data[portNum]['restaurant_price']) +1) + '' ;
  }

  return recommend_restaurant(response, portNum);
}

//request a resturant with different restaurant style
function restaurant_style_switch(response, portNum){
  
  user_data[portNum]['restaurant_style'] = response.result.parameters["restaurant_style"];
  return recommend_restaurant(response, portNum);
}


//inquire about hotel facility
function inquire_hotel_facility(response, portNum){
  //if user has already inquired a facility
  var inquiredFacility = "";
  var closeOrOpen = "";
  if(user_data[portNum]["last_inquired_facility"].length &&user_data[portNum]["last_inquired_facility"].length > 0){
    inquiredFacility =  user_data[portNum]["last_inquired_facility"];
  }
  else{
    inquiredFacility = response.result.parameters["hotel_facility"];
  }
  var inquiryParameter = response.result.parameters["inquiry_parameter"];
  if("hotel_facility_close_open" in response.result.parameters){
    closeOrOpen = response.result.parameters["hotel_facility_close_open"];  
  }
  
  var inquiredLocation= "";
  var inquiredTime = "";
  
  //if there is no such facility
  
  response = "Sorry we don't have such facility";
  
  hotel_facility_data.forEach(function(hotel_facility){
    
    var name = hotel_facility.name;
    var location = hotel_facility.location;
    var opening_time = hotel_facility.opening_time;
    var closing_time = hotel_facility.closing_time;

    if(name == inquiredFacility){
      inquiredLocation = location;
      
      //if the inquiry is about closing or opening time
      if(inquiryParameter == "time"){
        if(closeOrOpen == "close"){
          response = name + " will close at "+ closing_time;
        }
        else{
           response = name + " will open at "+ opening_time; 
        }
      } 
      else{
        response = name + " is "+ location;
      }
    }
  });
  return response;
}
//inquire about room facility
function inquire_room_facility(response, portNum){
  var inquired_facility = response.result.parameters["Roomservicetype"];  
  response = "Sorry we don't have such room facility.";

  room_facility_data.forEach(function(room_facility){
    var name = room_facility.name;
    var location = room_facility.location;

    if(name == inquired_facility){
      response = name + " is " + location;
    }
  });

  return response;
}

//
function parse_price(unit_currency){
  //check if unit_currency is an object
  if(typeof(unit_currency) == "object"){
    return String(unit_currency.amount);
  }
  else return unit_currency;
}

function read_csv(){
  //read in restaurant data
  d3.csv("/restaurant.csv", function(data) {
    if(data){
      //console.log(data);
      var i=0;
      data.forEach(function(row) {
        var restaurant_name = row.name;
        var restaurant_style = row.style;
        var price = row.price;
        var location = row.location;
        
        
        restaurant = {
          'name': restaurant_name,
          'style': restaurant_style,
          'price': price,
          'location': location
        }
        restaurant_data.push(restaurant);    
      });  
    }
   // console.log(restaurant_data);
  });
  
  //read in room facility data
  d3.csv("/room_facility.csv", function(data) {
    if(data){
      //console.log(data);
      var i=0;
      data.forEach(function(row) {
        var name = row.name;
        var location = row.location;
        
        
        
        var facility = {
          'name': name,
          'location': location
          
        }
        room_facility_data.push(facility);    
      });  
    }
   //console.log(room_facility_data);
  });

  //read in hotel facility data
  d3.csv("/hotel_facility.csv", function(data) {
    if(data){
      
      
      data.forEach(function(row) {
        var name = row.name;
        var location = row.location;
        var opening_time = row.opening_time;
        var closing_time = row.closing_time;
        
        
        var facility = {
          'name': name,
          'location': location,
          'opening_time': opening_time,
          'closing_time': closing_time
          
        }

        hotel_facility_data.push(facility);    
      });  
    }
   console.log(hotel_facility_data);
  });
}

