var mongoose = require('mongoose');

// Create a mongoDB model
module.exports = mongoose.model('Restaurant', {
  name: {
    type: String,
    default: ''
  },
  style: {
    type: String,
    default: ''
  }
});