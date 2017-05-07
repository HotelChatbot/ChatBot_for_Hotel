var express = require('express');
var app = express();
var http = require('http').Server(app);
// Base socket.io on express app
var io = require('socket.io')(http);
// Constanize the port number
var port = process.env.PORT || 8080;

// Use mongoose to manipulate mongoDB
var mongoose = require('mongoose');
// Load the database config
var database = require('./config/database');

// Parse the request body
var bodyParser = require('body-parser');

// Dialog Manager
var apiai = require('apiai');

// Http Request
var request = require('request');

// Global Initialization
var TOKEN_DemoAgent = "ecc353311a954139b3ff036c8f6eb2ae";
var TOKEN_ServerTest = "8010c7fae89f4faeb8fe10470ae77742";

// Weather Information
var weather = require('weather-js');

// Connect to database with specification
if (process.env.PORT) {
  mongoose.connect(database.remoteUrl);
} else {
  mongoose.connect(database.localUrl);
}

// Load in all the required data from Mongo Database
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'Database Connection Error:'));
db.once('open', function() {
  console.log("Database Ready! Connected to: " + db.name);

  db.collection('restaurant').find().toArray(function(err, restaurant) {
    read_csv(restaurant, "restaurant");
  });

  db.collection('hotel_facility').find().toArray(function(err, hotel_facility) {
    read_csv(hotel_facility, "hotel_facility");
  });

  db.collection('room_facility').find().toArray(function(err, room_facility) {
    read_csv(room_facility, "room_facility");
  });

  db.collection('tourist_spot').find().toArray(function(err, tourist_spot) {
    read_csv(tourist_spot, "tourist_spot");
  });
  db.close();
});


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
var tourist_spot_data = [];
var weather_data = {};
// Build up the routers
require('./app/routes.js')(app, io);


app.get('/api/confirm', function(req,res){
  var sysOutput = "Your booking of the restaurant is confirmed."

  var sysOutputObj = {message: sysOutput, image: ""};
  io.sockets.emit("response_from_apiai",sysOutputObj);
  res.json({'status':200})
});

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
        'last_inquired_facility' : "",
        'tourist_spot_name':"",
        'tourist_spot_style':"",
        'last_response':""
      };
      user_data[portNum]['recommend_restaurant'] = new Set() ;
      user_data[portNum]['recommend_tourist_spot'] = new Set() ;
      //current requested price range
      user_data[portNum]['restaurant_price_request'] = ['<', '1000'];
    }

    var isTouristSpot = false;
    // Waiting for the response from api.ai
    request.on('response', function(response) {
      var sysOutput = response.result.fulfillment.speech;
      console.log(sysOutput);
      var action =  response.result.action;
      //perform action if needed
      if(action.length > 0) {
        console.log("action",action);
        if(action.indexOf('tourist')>-1)isTouristSpot = true;
        //decide ouput by evaluating the action
        sysOutput = eval_action(action, response, portNum);
        //console.log(JSON.stringify(sysOutput, null, 2));
        console.log("Chatbot: " + sysOutput);
      }

      user_data[portNum]['last_response'] = sysOutput;


      // Required to be an object
      // Example to send a message along with a image

      var imageURL = "";
      console.log("sysOutput" + sysOutput)
      if(sysOutput.indexOf("restaurant") > -1 && sysOutput.indexOf("What") == -1){

        var imageURL = "image/restaurant/"  + user_data[portNum]['restaurant_name'] + '.png';
      }
      else if(isTouristSpot){
        isTouristSpot = false;
        var imageURL = "image/tourist_spot/"  + user_data[portNum]['tourist_spot_name'] + '.png';
      }
      console.log("imageURL"+imageURL+imageURL.length);
      var sysOutputObj = {message: sysOutput, image: imageURL};

      // Send message without an image
      // var sysOutputObj = {message: sysOutput, image: ""};


      // Notify the front-end along with the response from api.ai
      socket.emit("response_from_apiai",sysOutputObj);

    });

    request.on('error', function(error) {
      console.log(error);
    });

    request.end();

  });

});

// Load Weather Data beforehand to speed up response
weather.find({search: 'Hong Kong SAR', degreeType: 'C'}, function(err, result) {
  if(err) console.log(err);
  weather_data = result[0];
});

// Listening on the port
http.listen(port, function(){
  console.log('listening on *:' + port);
});


/**
* Evaluate function passed by api.ai.
*
* @method eval_action
* @param {String} action Action passed from api.ai.
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
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
    case "tourist_spot_blunt":
      response = tourist_spot_blunt(response,portNum);
      break;
    case "tourist_spot_give_detail":
      response = tourist_spot_give_detail(response, portNum);
      break;
    case "recomend_tourist_spot_with_type":
      response = recomend_tourist_spot_with_type(response, portNum);
      break;
    case "hotel_facility_check_open":
      response = hotel_facility_check_open(response, portNum);
      break;
    case "repeat_response":
      response = repeat_response(response, portNum);
      break;
    case "iot_control":
      response = iot_control(response, portNum);
      break;
    case "check_current_weather":
      response = check_current_weather(response, portNum);
      break;
    case "check_predict_weather":
      response = check_predict_weather(response, portNum);
      break;
    case "reserve_restaurant":
      response = reserve_restaurant(response, portNum);
      break;
    case "room_service_item":
      response = room_service_item(response, portNum);
      break;

    case "mode_control":
      response = mode_control(response, portNum);
      break;
  }

  return response;
}


/**
* Basic recommend restaurant function.
*
* @method recommend_restaurant
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function recommend_restaurant(response, portNum){
  //extract user request from the JSON response
  var priceRequest = "";
  var styleRequest = "";
  var extremeRequest = "";
  if( 'unit-currency' in response.result.parameters){
    priceRequest = parse_price(response.result.parameters['unit-currency']);
  }
  if('restaurant_style' in response.result.parameters){
    styleRequest = response.result.parameters["restaurant_style"];
  }
  if('restaurant_extreme_price' in response.result.parameters){
    extremeRequest = response.result.parameters["restaurant_extreme_price"]

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

  console.log("priceRequest",priceRequest);
  console.log("styleRequest",styleRequest);

  //initialize variables for the later loop
  var currentPrice = "";
  var currentRestaurant = "";

  if(extremeRequest.length>0){
    console.log(extremeRequest)
    var lastPrice;
    if(extremeRequest == "cheapest") lastPrice = 88888;
    else lastPrice = 0;
    restaurant_data.forEach(function(restaurant){
      var name = restaurant.name;
      var price = restaurant.price;
      var style = restaurant.style;
      var location = restaurant.location;
      //if the restaurant has not been recommended yet
      if(!user_data[portNum]['recommend_restaurant'].has( name )){

        //if the style match the style request
        if( style == user_data[portNum]['restaurant_style'] || styleRequest.length==0){

          //if user request

          if((parseInt(price) >= parseInt(lastPrice) &&extremeRequest == "most expensive") ||
            (parseInt(price) <= parseInt(lastPrice) &&extremeRequest == "cheapest")){
            currentRestaurant = name;
            //update current user's data
            user_data[portNum]['restaurant_price'] = price;
            user_data[portNum]['restaurant_name'] = currentRestaurant;
            lastPrice = price;

          }
        }
      }
    });

  }
  else{
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
          // console.log(price)
          //update current user's data
          user_data[portNum]['restaurant_price'] = price;
          user_data[portNum]['restaurant_name'] = currentRestaurant;
          user_data[portNum]['restaurant_style'] = style;

        }
      }
    }
  });
  }

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

/**
* Provide user information about the restaurant.
*
* @method restaurant_give_detail
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
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

        response = "the restaurant is located at " + location + " and it costs you around "+ price;
    }

  });
  return response;
}

/**
* Provide user price of the restaurant.
*
* @method restaurant_check_price
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
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

/**
* Request a resturant with different price range.
*
* @method restaurant_price_switch
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
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

/**
* Request a resturant with different restaurant style.
*
* @method restaurant_style_switch
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function restaurant_style_switch(response, portNum){

  user_data[portNum]['restaurant_style'] = response.result.parameters["restaurant_style"];
  return recommend_restaurant(response, portNum);
}


/**
* Inquire about hotel facility.
*
* @method inquire_hotel_facility
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function inquire_hotel_facility(response, portNum){
  //if user has already inquired a facility
  var inquiredFacility = "";
  var closeOrOpen = "";
  if(response.result.parameters["hotel_facility"].length==0 &&user_data[portNum]["last_inquired_facility"].length > 0){
    inquiredFacility =  user_data[portNum]["last_inquired_facility"];
  }
  else{
    inquiredFacility = response.result.parameters["hotel_facility"];
  }
  var inquiryParameter = response.result.parameters["inquiry_parameter"];
  if("hotel_facility_close_open" in response.result.parameters){
    closeOrOpen = response.result.parameters["hotel_facility_close_open"];
  }
 hotel_facility_check_open
  //user did not specify facility at all
  if(inquiredFacility.length==0){
    return "Which facility are you asking?";
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
      if(closeOrOpen.length>0 || inquiryParameter == "time"){
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
      user_data[portNum]["last_inquired_facility"] = name;
    }
  });
  console.log(user_data);
  return response;
}

/**
* Inquire about room facility.
*
* @method inquire_room_facility
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
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

/**
* Recommend a tourist spot without stlye specification.
*
* @method tourist_spot_blunt
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function tourist_spot_blunt(response,portNum){
  //set style to be "whatever"
  user_data[portNum]['tourist_spot_style'] = "whatever";
  if('tourist-spot-architecture' in response.result.parameters){
    user_data[portNum]['tourist_spot_style'] = response.result.parameters["tourist-spot-architecture"];
  }
  return recommend_tourist_spot(response,portNum);
}

/**
* Recommend a tourist spot with stlye specification.
*
* @method recommend_tourist_spot_with_type
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function recomend_tourist_spot_with_type(response, portNum){

  if('tourist-spot-architecture' in response.result.parameters){
    //set style as the response passed by user
    user_data[portNum]['tourist_spot_style'] = response.result.parameters["tourist-spot-architecture"];
  }
  return recommend_tourist_spot(response,portNum);

}

/**
* General function for recommend a tourist spot.
*
* @method recommend_tourist_spot
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function recommend_tourist_spot(response,portNum){
  //initialize variables for the later loop

  var currentTouristSpot = "";
  var currentDistance = "";
  tourist_spot_data.forEach(function(tourist_spot){
    var name = tourist_spot.name;
    var price = tourist_spot.price;
    var style = tourist_spot.style;
    var distance = tourist_spot.distance;
    //if the restaurant has not been recommended yet
    if(!user_data[portNum]['recommend_tourist_spot'].has( name )){

      //if the style match the style request
      if(user_data[portNum]['tourist_spot_style'] == "whatever" || style == user_data[portNum]['tourist_spot_style'] ){
        //store this tourist spot into the iteratoin variable
        currentTouristSpot = name;
        currentDistance = distance;
        user_data[portNum]['tourist_spot_style'] = style;
        user_data[portNum]['tourist_spot_name'] = name;
      }
    }
  });
  console.log()
  //no spot found
  if(!currentTouristSpot){
    //might need to come up with a way to recommend user touristspot with another style
    //might need to reset context here
    console.log("No tourist spot");
    //if user did not specify restaurant style
    response = "Sorry we cannot find any tourist spot that meets your criteria. What kind of tourist spot do you like";

  }
  else{
    //add current restaurant to the set so that you don't duplicate recommendation
    user_data[portNum]['recommend_tourist_spot'].add(currentTouristSpot);

    console.log(user_data);
    //concatenate data into response
    response = "Here is a "+ user_data[portNum]['tourist_spot_style'] + " called " + currentTouristSpot +" that is " + currentDistance +" away from you.";
  }

  return response;
}
/**
* Provide user with the detail information about the tourist spot.
*
* @method tourist_spot_give_detail
* @param {String} response Speech response passed from api.ai.
* @param {Integer} portNum Current end user's port number connecting to the server
* @return {String} response Speech response that will return to the end user.
*/
function tourist_spot_give_detail(response, portNum){
  console.log(user_data[portNum]["tourist_spot_name"]);
  tourist_spot_data.forEach(function(tourist_spot){
    var name = tourist_spot.name;
    var price = tourist_spot.price;
    var style = tourist_spot.style;
    var distance = tourist_spot.distance;
    //if the restaurant has not been recommended yet
    console.log(name, user_data[portNum]["tourist_spot_name"]);
    if(name == user_data[portNum]["tourist_spot_name"]){
      response = name + " costs around " + price + " and it is " + distance +" away from you";

    }
  });
  console.log("ggg");
  return response;
}

function hotel_facility_check_open(response, portNum){
  var closeOrOpen="";
  var facility="";
  var date ="";
  var time = "";

  if("hotel_facility_close_open" in response.result.parameters){

    closeOrOpen = response.result.parameters["hotel_facility_close_open"];
  }
  if("hotel_facility" in response.result.parameters && response.result.parameters.hotel_facility.length >0){
    facility = response.result.parameters["hotel_facility"];
  }
  else{
    facility = user_data[portNum]['last_inquired_facility'];
  }
  if("date-period" in response.result.parameters){
    date = response.result.parameters["date-period"];
  }
  if("time" in response.result.parameters){
    time = response.result.parameters["time"];
  }


  if(facility.length ==0){
    return "which facility are you talking about";
  }

  if( date == "Saturday" || date == "Sunday"){
    reponse = ""
    hotel_facility_data.forEach(function(hotel_facility){

      var name = hotel_facility.name;
      var location = hotel_facility.location;
      var opening_time = hotel_facility.opening_time;
      var closing_time = hotel_facility.closing_time;


      if(name == facility){


        response = "It is closed on " + date;


      }
    });
    if(response.length ==0) return "Sorry we don't have such facility.";
    else return response;
  }
  else if (date.length >0){
    response = ""
    hotel_facility_data.forEach(function(hotel_facility){

      var name = hotel_facility.name;
      var location = hotel_facility.location;
      var opening_time = hotel_facility.opening_time;
      var closing_time = hotel_facility.closing_time;


      if(name == facility){
        response = "It is open on " +date;


        //if the inquiry is about closing or opening time


        if(closeOrOpen == "close"){

          response += " and will closes at "+ closing_time;
        }
        else{

          response += " and will opens at "+ opening_time;
        }

      }
    });
    if(response.length ==0) return "Sorry we don't have such facility.";
    else return response;
  }

  else{
    //user is asking if the gym is open now
    response = ""
    var specifiedTime = false
    if(time.length == 0){

      time = new Date().getHours()

    }
    else{
      time = parseInt( time.substr(0,2));
      specifiedTime = true
    }

    hotel_facility_data.forEach(function(hotel_facility){

      var name = hotel_facility.name;
      var location = hotel_facility.location;
      var opening_time = hotel_facility.opening_time;
      var closing_time = hotel_facility.closing_time;

      if(name == facility){
        //if the inquiry is about closing or opening time
        var openOrClose
        if (isOpen(time, opening_time, closing_time)){
          openOrClose = "open";
        }
        else openOrClose = "closed";

        if (specifiedTime)response = "The " + facility + " is " + openOrClose + " then.";
        else response = "The " + facility + " is " + openOrClose + " now.";

      }
    });
    if(response.length ==0) return "Sorry we don't have such facility.";
    else return response;
  }
}

function iot_control(response,portNum){


  var url = "https://young-castle-82935.herokuapp.com/api/facility";
  var action;
  var facility;
  if("iot_action" in response.result.parameters){
    action = response.result.parameters["iot_action"];
  }

  if("iot_facility" in response.result.parameters){
    facility = response.result.parameters["iot_facility"];
  }
  var parameters = {'action':action, 'facility':facility};
  request({url:url, qs:parameters},function(err,response, body){
    if(err) { console.log(err); return "error"; }
    console.log("Get response: " + response.statusCode);
  });
  // console.log(response.result.fulfillment.speech
  return response.result.fulfillment.speech
}

function repeat_response(response, portNum){
  return user_data[portNum]['last_response']
}

/**
* Handles probelm when the unit_curreny parameter passed by api.ai is not a string.
*
* @function parse_price
* @param {Object} unit_currency Part of the JSON response passed from api.ai.
* @return {String} unit_currency Speech response that will return to the end user.
*/

function parse_price(unit_currency){
  //check if unit_currency is an object
  if(typeof(unit_currency) == "object"){
    return String(unit_currency.amount);
  }
  else return unit_currency;
}

/**
* Reads data from CSV into server.
*
* @method read_csv
*/

function read_csv(data, collectionName){

  if (data){

    if (collectionName == "restaurant") {
      restaurant_data = data;

    } else if (collectionName == "room_facility") {
      room_facility_data = data;
    } else if (collectionName == "hotel_facility") {
      hotel_facility_data = data;

    } else if (collectionName == "tourist_spot") {
      tourist_spot_data = data;

    }

  } else {
    console.log("Empty Data Collection: " + collectionName);
  }

}


function isOpen(time, open, close){
  var openTime = parseInt(open.substr(0,2))
  var closeTime = parseInt(close.substr(0,2))
  var openM;
  var closeM;
  var timeM;
  if(open.indexOf("PM") > -1){
    openTime += 12
  }


  if(close.indexOf("PM") > -1){
    closeTime += 12
  }
  if (time>= openTime && time < closeTime) return true
  else return false;


}

/*
var check_current_weather = weather.find({search: 'Hong Kong SAR', degreeType: 'C'}, function(err, result) {
    if(err) console.log(err);
    var current = result[0].current;
    console.log(JSON.stringify(current, null, 2));

    response = "This is the weather";
    return response;
  });
*/


function check_current_weather(response, portNum){
  var current = weather_data.current;
  response = "The weather today is " + current.skytext + ", and the temperature is around " + current.temperature + " in Celsius degree. The humidity is " + current.humidity + " percent. Have a great day!";
  return response;
}

function check_predict_weather(response, portNum){

  var date = response.result.parameters.date;
  var forecast = weather_data.forecast;

  var i = 0;
  while (i < forecast.length){
    console.log(forecast[i].date + " =?= " + date);
    if (forecast[i].date == date){

      response = "The weather forecast for the day is " + forecast[i].skytextday + ", and the temperature is from " + forecast[i].low + " to " + forecast[i].high + " in Celsius degree.";
      return response;
    }
    i += 1;
  }

  response = "Sorry, the weather forecast for the day is not available.";
  return response;
}

function mode_control(response, portNum){
  var url = "https://young-castle-82935.herokuapp.com/api/mode";
  // var url ="http://localhost:5009/api/mode";
  var mode;
  if("room_mode" in response.result.parameters){
    mode = response.result.parameters["room_mode"];
      console.log(mode);
  }
  request({url:url,qs:{'mode':mode}}, function(err, response, body){
  if(err){console.log('error:', err);}
  console.log("Get response: " + response.statusCode);
  });
  return response.result.fulfillment.speech;
}

function reserve_restaurant(response, portNum){
  context = response.result.contexts[0];
  console.log(context.parameters.time)
  console.log(context.parameters.number)
  var url ="https://jibi-restaurant-management.herokuapp.com/api/reserve"
  var parameters = {'time':context.parameters.time, 'people':context.parameters.number}
  request({url:url, qs:parameters},function(err,response, body){
      if(err) { console.log(err); return "error"; }
      console.log("Get response: " + response.statusCode);
    });
  // console.log(parameters)
  return response.result.fulfillment.speech;
}

function room_service_item(response, portNum){
  var url = "";
  var room_service_type;
  var number;
  if("Roomservicetype" in response.result.parameters){
    room_service_type = response.result.parameters["Roomservicetype"];
  }

  if("number" in response.result.parameters){
    number = response.result.parameters["number"];
  }
  var parameters = {Roomservicetype:action, number:number};
  request({url:url, qs:parameters},function(err,response, body){
    if(err) { console.log(err); return "error"; }
    console.log("Get response: " + response.statusCode);
  });
  return response.result.fulfillment.speech

}
