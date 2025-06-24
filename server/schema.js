const Message = mongoose.model("Message", new mongoose.Schema({
  sender: String,
  text: String,
  roomId: String, 
  timestamp: {
    type: Date,
    default: Date.now
  }
}));
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true }
});

