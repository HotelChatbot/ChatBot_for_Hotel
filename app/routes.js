
// Load the database model
var Restaurant = require('./models/Restaurant');


// Prepare the model API for usage
module.exports = function(app) {

  app.get('/api/test', function(req, res) {
    res.json({"status":"OK"});
  });


  // Get all restaurant documents
  app.get('/api/restaurants', function(req, res) {
    Restaurant.find(function(err, restaurants) {
      // Error handler
      if (err)
        res.send(err);
      // return all restaurants in JSON format
      res.json(restaurants);
    });
  });


  // Create a restaurant document
  app.post('/api/restaurants', function (req, res) {
    Restaurant.create({
      name: "test",
      style: "test"
    }, function(err, restaurants) {
      if (err)
        res.send(err);

      res.json(restaurants);
    });
  });


}