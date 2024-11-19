// Require mongoose
const mongoose = require("mongoose");

// User info schema
const Schema = mongoose.Schema;

const userData = new Schema({
  firstName: String,
  lastName: String,
  username: String,
  dateOfBirth: String,
  email: String,
  password: String,
  location: String,
  instagramLink: String,
  facebookLink: String,
  twitterLink: String,
  youtubeLink: String,
  customLink: String,
  bio: String,
  profilePic: {
    type: String,
    default: null
  },
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'user_info'
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'user_info'
  }],
  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'user_info'
  }],
});

// Export function to create "user_info" model class
module.exports = mongoose.model("user_info", userData);