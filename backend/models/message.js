const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
  },
  receiver: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

// Index for better query performance
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });

module.exports = mongoose.model("Message", messageSchema);
