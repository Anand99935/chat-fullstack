const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // email: { type: String, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to increment unread count for a specific sender
UserSchema.methods.incrementUnreadCount = function(senderEmail) {
  const currentCount = this.unreadCounts.get(senderEmail) || 0;
  this.unreadCounts.set(senderEmail, currentCount + 1);
  return this.save();
};

// Method to reset unread count for a specific sender
UserSchema.methods.resetUnreadCount = function(senderEmail) {
  this.unreadCounts.set(senderEmail, 0);
  return this.save();
};

// Method to get total unread count
UserSchema.methods.getTotalUnreadCount = function() {
  let total = 0;
  for (let count of this.unreadCounts.values()) {
    total += count;
  }
  return total;
};

module.exports = mongoose.model("User", UserSchema);
