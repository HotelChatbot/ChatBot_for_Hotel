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
  price: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  style: {
    type: String,
    default: ''
  }
});