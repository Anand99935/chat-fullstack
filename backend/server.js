const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const Message = require('./models/message');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);

// ✅ Middleware 
const allowedOrigins = [
  "http://localhost:3000",
  // "https://anand99935.github.io",
  "https://chat-system-5.onrender.com"
];

// ✅ Admin login check
const ADMIN_CREDENTIALS = {
  name: 'Admin',
  email: 'admin@chat.com'
};
app.options('*', cors());

//sending img/video by cloudinary
cloudinary.config({
  cloud_name: 'dtmfrtwy4',
  api_key: '629516584655468',
  api_secret: '8k-EvIFA-ZcNDI-Po1M-8J6oQKw'
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov'],
  },
});

const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  res.json({ url: req.file.path }); // Cloudinary file URL
});
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());


// ✅ Login route (admin + user)
app.post('/api/login', async (req, res) => {
  let { name, email, isAdmin } = req.body;
  email = email.trim().toLowerCase(); // 👈 Add this line

  if (isAdmin) {
    if (name === ADMIN_CREDENTIALS.name && email === ADMIN_CREDENTIALS.email) {
      return res.json({
        success: true,
        user: { name, email },
        isAdmin: true
      });
    } else {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
  }

  try {
    const existingUser = await User.findOne({ name, email });
    if (existingUser) {
      return res.status(200).json({ success: true, user: existingUser });
    }

    const newUser = new User({ name, email });
    const savedUser = await newUser.save();
    return res.status(201).json({ success: true, user: savedUser });

  } catch (err) {
    console.error("❌ Login DB error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ MongoDB
mongoose.connect('mongodb+srv://businesskeyutech:86vT98mp3O1oJmM0@cluster0.ramskda.mongodb.net/chatapp?retryWrites=true&w=majority')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ✅ REST routes
app.get("/", (req, res) => {
  res.send("💬 Chat backend is running...");
});

app.get('/messages', async (req, res) => {
    try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
  const { user1, user2, limit = 20, offset = 0 } = req.query;
  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 }
    ]
  })
    .sort({ timestamp: -1 }) // latest first
    .skip(Number(offset))
    .limit(Number(limit));
  res.json(messages.reverse()); // reverse for oldest first in UI
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/users-with-last-message", async (req, res) => {
  try {
    const users = await User.find({ email: { $ne: ADMIN_CREDENTIALS.email } }, "name email");

    // For each user, find the last message between admin and user
    const adminEmail = ADMIN_CREDENTIALS.email;
    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const lastMsg = await Message.findOne({
        $or: [
          { sender: user.email, receiver: adminEmail },
          { sender: adminEmail, receiver: user.email }
        ]
      }).sort({ timestamp: -1 });

      // Format time (e.g. "10:45 AM" or "Yesterday" etc.)
      let lastMessageTime = "";
      if (lastMsg && lastMsg.timestamp) {
        const date = new Date(lastMsg.timestamp);
        lastMessageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return {
        ...user.toObject(),
        lastMessageTime: lastMsg ? lastMsg.timestamp : null, // original timestamp
        lastMessageTimeFormatted: lastMessageTime, // formatted time string
        lastMessage: lastMsg ? lastMsg.text : ""
      };
    }));

    // Sort users by lastMessageTime descending
    usersWithLastMsg.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json(usersWithLastMsg);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users with last message" });
  }
});

app.get("/api/messages/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const messages = await Message.find({ sender: userEmail }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// admin user conversation
app.get("/api/conversation/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const adminEmail = ADMIN_CREDENTIALS.email;
    const messages = await Message.find({
      $or: [
        { sender: userEmail, receiver: adminEmail },
        { sender: adminEmail, receiver: userEmail }
      ] 
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});



// ✅ Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("send-message", async (data) => {
    const { sender,receiver , text } = data;
if (!sender || !receiver || !text) return;
    const newMessage = new Message({ sender,receiver, text });

    try {
      const saved = await newMessage.save();
      io.emit("receive-message", saved);
    } catch (err) {
      console.error("❌ Save message error:", err);
    }
  });

//typing indicator when user-admin types.
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  socket.on("stop-typing", (data) => {
    socket.broadcast.emit("stop-typing", data);
  });

  socket.on("disconnect", () => {
    console.log("🚪 User disconnected:", socket.id);
  });
});

let lastMessageTime = "";
if (lastMsg && lastMsg.timestamp) {
  const date = new Date(lastMsg.timestamp);
  const now = new Date();

  // Remove time part for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = nowOnly - dateOnly;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (diffDays === 0) {
    // Today
    lastMessageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 86400000 / (1000 * 60 * 60 * 24)) {
    // Yesterday
    lastMessageTime = "Yesterday";
  } else {
    // Date (e.g. 24/06/2025)
    lastMessageTime = date.toLocaleDateString();
  }
}

// ✅ Server start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});