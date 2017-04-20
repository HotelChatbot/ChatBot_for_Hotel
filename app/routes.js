
// Load the database model
var Restaurant = require('./models/Restaurant');


// Prepare the model API for usage
module.exports = function(app) {

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


  // Create a restaurant document
  /*
  app.post('/api/restaurant', function (req, res) {
    Restaurant.create({
      name: "test",
      style: "test"
    }, function(err, restaurant) {
      if (err)
        res.send(err);

      res.json(restaurant);
    });
  });
  */

}