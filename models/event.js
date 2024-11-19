// require mongoose
const mongoose = require("mongoose");


// Event Schema
var event = new mongoose.Schema({
  eventID: String,
  userID: String,
  eventTitle: String,
  capacity: String,
  visible: Boolean,
  public: Boolean,
  date: String,
  time: String,
  timezone: String,
  description: String,
  eventLocation: String,
  Attendees: String,
  updated: { type: Date, default: Date.now() },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user_info'
  }
})

// Export function to create "events" model class
module.exports = mongoose.model("event", event);