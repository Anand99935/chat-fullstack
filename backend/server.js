require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const Message = require('./models/message');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-system-5.onrender.com",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Admin credentials from environment variables
const ADMIN_CREDENTIALS = {
  name: process.env.ADMIN_NAME || 'Admin',
  email: process.env.ADMIN_EMAIL || 'admin@chat.com'
};

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtmfrtwy4',
  api_key: process.env.CLOUDINARY_API_KEY || '629516584655468',
  api_secret: process.env.CLOUDINARY_API_SECRET || '8k-EvIFA-ZcNDI-Po1M-8J6oQKw'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' }
    ]
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: req.file.path });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    let { name, email, isAdmin } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    email = email.trim().toLowerCase();

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

    const existingUser = await User.findOne({ email });
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

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://businesskeyutech:86vT98mp3O1oJmM0@cluster0.ramskda.mongodb.net/chatapp?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// API Routes
app.get("/", (req, res) => {
  res.json({ message: "💬 Chat backend is running...", version: "1.0.0" });
});

// Get messages with pagination
app.get('/api/messages', async (req, res) => {
  try {
    const { user1, user2, limit = 20, offset = 0 } = req.query;
    
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'user1 and user2 parameters are required' });
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    })
    .sort({ timestamp: -1 })
    .skip(Number(offset))
    .limit(Number(limit))
    .lean();

    res.json(messages.reverse());
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "name email createdAt").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get users with last message (for admin panel)
app.get("/api/users-with-last-message", async (req, res) => {
  try {
    const users = await User.find({ email: { $ne: ADMIN_CREDENTIALS.email } }, "name email createdAt");

    const adminEmail = ADMIN_CREDENTIALS.email;
    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const lastMsg = await Message.findOne({
        $or: [
          { sender: user.email, receiver: adminEmail },
          { sender: adminEmail, receiver: user.email }
        ]
      }).sort({ timestamp: -1 }).lean();

      let lastMessageTime = "";
      if (lastMsg && lastMsg.timestamp) {
        const date = new Date(lastMsg.timestamp);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastMessageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
          lastMessageTime = "Yesterday";
        } else {
          lastMessageTime = date.toLocaleDateString();
        }
      }

      return {
        ...user.toObject(),
        lastMessageTime: lastMsg ? lastMsg.timestamp : null,
        lastMessageTimeFormatted: lastMessageTime,
        lastMessage: lastMsg ? lastMsg.text : ""
      };
    }));

    usersWithLastMsg.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.json(usersWithLastMsg);
  } catch (err) {
    console.error('Error fetching users with last message:', err);
    res.status(500).json({ error: "Failed to fetch users with last message" });
  }
});

// Get conversation between admin and user
app.get("/api/conversation/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const adminEmail = ADMIN_CREDENTIALS.email;
    
    const messages = await Message.find({
      $or: [
        { sender: userEmail, receiver: adminEmail },
        { sender: adminEmail, receiver: userEmail }
      ] 
    }).sort({ timestamp: 1 }).lean();
    
    res.json(messages);
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("send-message", async (data) => {
    try {
      const { sender, receiver, text, type = 'text' } = data;
      
      if (!sender || !receiver || !text) {
        console.log('Invalid message data:', data);
        return;
      }

      const newMessage = new Message({ sender, receiver, text, type });
      const saved = await newMessage.save();
      
      io.emit("receive-message", saved);
    } catch (err) {
      console.error("❌ Save message error:", err);
      socket.emit("message-error", { error: "Failed to save message" });
    }
  });

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Server start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});