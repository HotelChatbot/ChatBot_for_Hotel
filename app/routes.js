// Load the database model
var Restaurant = require('./models/Restaurant');

// Uber Configuration
var Uber = require('node-uber');

var CLIENT_ID = "IN9Xc4-wQps7sR2t-uRjKjjp9hXVtYY1";
var CLIENT_SECRET = "eoqfWkuAORNOF4yeWXOgTzjDMv_hxTEZolwJ3GES";
var SERVER_TOKEN = "ylwCO7P_HytTy-QhuIOgAVMiAZax1XP_bAp23mxz";
var REDIRECT_URL = "http://localhost:8080/api/uber/callback";

var uber = new Uber({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  server_token: SERVER_TOKEN,
  redirect_uri: REDIRECT_URL,
  name: 'Jibi',
  language: 'en_US', // optional, defaults to en_US
  sandbox: true // optional, defaults to false
});

// Addresses
var GPS = {
  "HKUST": {
    "lat": "22.3343523",
    "lng": "114.2673941"
  },
  "IFC": {
    "lat": "22.2858849",
    "lng": "114.1559423"
  }
}

function updateUberProfile(io){
  console.log("update uber profile");
  uber.user.getProfile(function (err, res) {
    if (err) return err;
    else {
      io.sockets.emit("uber profile", res);
      return res;
    }
  });
}



// Prepare the model API for usage
// Pass in the app and io
module.exports = function(app, io) {

  // Test the accessibility of the server
  app.get('/api/test', function(req, res) {
    res.json({"status":"OK"});
  });

  // Get all restaurant documents
  app.get('/api/restaurant', function(req, res) {
    Restaurant.find(function(err, restaurant) {
      // Error handler
      if (err)
        res.send(err);
      // return all restaurant in JSON format
      res.json(restaurant);
    });
  });

  // Uber login
  app.get('/api/uber/login', function(request, response) {
    var url = uber.getAuthorizeUrl(['history','profile', 'places']);
    response.redirect(url);
  });

  // Uber login callback (redirect URI)
  app.get('/api/uber/callback', function(request, response) {
     uber.authorizationAsync({authorization_code: request.query.code})
     .spread(function(access_token, refresh_token, authorizedScopes, tokenExpiration) {
       // store the user id and associated access_token, refresh_token, scopes and token expiration date 
       console.log('New access_token retrieved: ' + access_token);
       console.log('... token allows access to scopes: ' + authorizedScopes);
       console.log('... token is valid until: ' + tokenExpiration);
       console.log('... after token expiration, re-authorize using refresh_token: ' + refresh_token);
   
       // redirect the user back to your actual app 
       response.redirect('/api/uber/login/complete');
     })
     .error(function(err) {
       console.error(err);
     });
  });

  // Uber login complate
  app.get('/api/uber/login/complete', function(request, response) {
    //response.send('Authorization Complete\nPlease Try the following APIs:\n(1)/api/products\n(2)/api/getEstimates\n(3)/api/getPriceForRouteByAddressAsync\n(4)/api/getETAForLocationAsync\n(5)getPriceForRoute')
    response.redirect("/");
    updateUberProfile(io);
    //console.log(profile);
    //console.log("1234567890");
    //console.log(profile);
    
  });



}