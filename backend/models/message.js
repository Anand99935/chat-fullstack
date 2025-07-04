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
  senderEmail: {
    type: String,
    required: false, // Optional for backward compatibility
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
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

// Index for better query performance
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });

// Method to mark message as delivered
messageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Message", messageSchema);
