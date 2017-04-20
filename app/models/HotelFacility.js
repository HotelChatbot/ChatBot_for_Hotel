var mongoose = require('mongoose');

// Create a mongoDB model
module.exports = mongoose.model('Restaurant', {
  id: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  opening_time: {
    type: String,
    default: ''
  },
  closing_time: {
    type: String,
    default: ''
  }
});