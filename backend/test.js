const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://businesskeyutech:KeyuTech%40123@cluster0.ramskda.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ Connection error:", err));
