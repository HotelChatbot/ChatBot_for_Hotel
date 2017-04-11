
// Prepare the model API for usage
module.exports = function(app) {

  app.get('/api/test', function(req, res) {
    res.json({"status":"OK"});
  });

  app.post('/api/textInput', function(req, res) {
    res.send(req.body.userText);
  });


}