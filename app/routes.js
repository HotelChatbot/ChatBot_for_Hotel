// Prepare the model API for usage
module.exports = function(app) {

  app.get('/api/test', function(req, res) {
    res.json({"status":"OK"});
  });

}