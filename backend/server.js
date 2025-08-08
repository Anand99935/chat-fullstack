require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const Message = require('./models/message');
const User = require('./models/user');

const app = express();
app.set('trust proxy', 1);

// ===== PROPER ENVIRONMENT DETECTION =====
// Check if we're actually on the production server (not just NODE_ENV)
const isActualProduction = () => {
  // Check if SSL certificates exist (only on production server)
  const sslKeyExists = fs.existsSync('/etc/letsencrypt/live/chats.dronanatural.com/privkey.pem');
  const sslCertExists = fs.existsSync('/etc/letsencrypt/live/chats.dronanatural.com/fullchain.pem');
  
  // Check if we're on the actual production server by hostname or other indicators
  const hostname = require('os').hostname();
  const isProductionServer = hostname.includes('droplet') || // DigitalOcean
                            hostname.includes('ubuntu') ||   // Common VPS
                            process.env.SERVER_TYPE === 'production';
  
  return sslKeyExists && sslCertExists && (process.env.NODE_ENV === 'production' || isProductionServer);
};

// Set environment based on actual conditions
const ACTUAL_ENVIRONMENT = isActualProduction() ? 'production' : 'development';
console.log(`🔍 Detected Environment: ${ACTUAL_ENVIRONMENT}`);
console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`💻 Hostname: $app.use(cors{require('os').hostname()}`);

// CORS configuration
const allowedOrigins = [
  "https://chats.dronanatural.com",
  "https://www.dronanatural.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://143.110.248.0:5000", // Droplet IP
  "wss://chats.dronanatural.com",
  "https://143.110.248.0",
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGIN
].filter(Boolean);

console.log("🌐 Allowed Origins:", allowedOrigins);

// ===== SMART SERVER INITIALIZATION =====
let server;

if (ACTUAL_ENVIRONMENT === 'production') {
  try {
    // SSL files before creating HTTPS server
    const sslKeyPath = '/etc/letsencrypt/live/chats.dronanatural.com/privkey.pem';
    const sslCertPath = '/etc/letsencrypt/live/chats.dronanatural.com/fullchain.pem';
    
    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
      const sslOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      };
      server = https.createServer(sslOptions, app);
      console.log("🔒 Using HTTPS (production with SSL)");
    } else {
      throw new Error('SSL certificates not found');
    }
  } catch (err) {
    console.error("❌ SSL setup failed:", err.message);
    // server = http.createServer(app);
    console.log("⚠️ Fallback to HTTP (SSL unavailable)");
  }
} else {
  server = http.createServer(app);
console.log("🔓 Using HTTP (behind NGINX reverse proxy)");
}

// Always use HTTP for backend when behind reverse proxy
server = http.createServer(app);
console.log("🔓 Using HTTP (behind NGINX reverse proxy)");

// Initialize Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: allowedOrigins ,
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
//   pingTimeout: 60000,
//   pingInterval: 25000,
//   transports: ['websocket', 'polling'],
//   allowEIO3: true,
//   maxHttpBufferSize: 1e8,
// });

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io/",
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// ===== MIDDLEWARE SETUP =====
app.use(compression());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
         "'self'",
         "https://chats.dronanatural.com",
         "wss://chats.dronanatural.com"
],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      fontSrc: ["'self'", "https:", "data:"],
      frameSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Logging middleware
// if (ACTUAL_ENVIRONMENT === 'development') {
//   app.use(morgan('dev'));
// } else {
//   app.use(morgan('combined'));
// }

// if (ACTUAL_ENVIRONMENT === 'production') {
//   app.use(express.static(path.join(__dirname, '../frontend/build')));
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
//   });
// }

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("🌐 Incoming Origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));


// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== CLOUDINARY CONFIGURATION =====
const ADMIN_CREDENTIALS = {
  name: process.env.ADMIN_NAME || 'Admin',
  email: process.env.ADMIN_EMAIL || 'admin@chat.com'
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtmfrtwy4',
  api_key: process.env.CLOUDINARY_API_KEY || '629516584655468',
  api_secret: process.env.CLOUDINARY_API_SECRET || '8k-EvIFA-ZcNDI-Po1M-8J6oQKw'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_uploads',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mkv'],
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto' }
    ],
    resource_type: 'auto'
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi', 'video/mkv'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// ===== UTILITY FUNCTIONS =====
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateMessageData = (data) => {
  const { sender, receiver, text } = data;
  return sender && receiver && text && text.trim().length > 0;
};

// ===== MONGODB CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close(); 
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0); 
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

// ===== ROUTES =====
// Debug middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ACTUAL_ENVIRONMENT,
    node_env: process.env.NODE_ENV,
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    ssl_enabled: server instanceof https.Server,
    hostname: require('os').hostname()
  };
  res.json(health);
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "💬 Chat backend is running...", 
    version: "1.0.0",
    environment: ACTUAL_ENVIRONMENT,
    endpoints: {
      health: "/health",
      login: "/api/login",
      upload: "/api/upload",
      messages: "/api/messages",
      users: "/api/users"
    }
  });
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/') && !req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    res.json({ 
      url: req.file.path,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    let { name, email, isAdmin } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

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

// Get messages
app.get('/api/messages', async (req, res) => {
  try {
    const { user1, user2, limit = 20, offset = 0 } = req.query;
    
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'user1 and user2 parameters are required' });
    }

    const limitNum = Math.min(Number(limit), 100);
    const offsetNum = Math.max(Number(offset), 0);

    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    })
    .sort({ timestamp: -1 })
    .skip(offsetNum)
    .limit(limitNum)
    .lean()
    .exec();

    res.json({
      messages: messages.reverse(),
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: messages.length === limitNum
      }
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const limitNum = Math.min(Number(limit), 100);
    const offsetNum = Math.max(Number(offset), 0);

    const users = await User.find({}, "name email createdAt isOnline lastSeen unreadCounts")
      .sort({ createdAt: -1 })
      .skip(offsetNum)
      .limit(limitNum)
      .lean()
      .exec();

    const totalUsers = await User.countDocuments();

    res.json({
      users,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: totalUsers,
        hasMore: offsetNum + limitNum < totalUsers
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get unread counts
app.get("/api/unread-counts/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (userEmail === ADMIN_CREDENTIALS.email) {
      return res.json({ unreadCounts: {} });
    }

    const user = await User.findOne({ email: userEmail }, "unreadCounts").lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let unreadCounts = {};
    if (user.unreadCounts && user.unreadCounts instanceof Map) {
      for (let [key, value] of user.unreadCounts) {
        unreadCounts[key] = value;
      }
    } else if (user.unreadCounts && typeof user.unreadCounts === 'object') {
      unreadCounts = user.unreadCounts;
    }

    res.json({ unreadCounts });
  } catch (err) {
    console.error('Error fetching unread counts:', err);
    res.status(500).json({ error: "Failed to fetch unread counts" });
  }
});

// Mark conversation as read
app.post("/api/mark-read", async (req, res) => {
  try {
    const { userEmail, senderEmail } = req.body;
    
    if (!validateEmail(userEmail) || !validateEmail(senderEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.resetUnreadCount(senderEmail);
    
    res.json({ 
      success: true, 
      message: 'Conversation marked as read',
      unreadCount: 0
    });
  } catch (err) {
    console.error('Error marking conversation as read:', err);
    res.status(500).json({ error: "Failed to mark conversation as read" });
  }
});

// Get total unread count
app.get("/api/total-unread/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (userEmail === ADMIN_CREDENTIALS.email) {
      return res.json({ totalUnread: 0 });
    }

    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalUnread = user.getTotalUnreadCount();
    
    res.json({ totalUnread });
  } catch (err) {
    console.error('Error fetching total unread count:', err);
    res.status(500).json({ error: "Failed to fetch total unread count" });
  }
});

// Get users with last message times
app.get("/api/users-with-last-message", async (req, res) => {
  try {
    const users = await User.find({ email: { $ne: ADMIN_CREDENTIALS.email } }, "name email createdAt")
      .lean()
      .exec();

    const adminEmail = ADMIN_CREDENTIALS.email;
    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const lastMsg = await Message.findOne({
        $or: [
          { sender: user.email, receiver: adminEmail },
          { sender: adminEmail, receiver: user.email }
        ]
      })
      .sort({ timestamp: -1 })
      .lean()
      .exec();

      return {
        ...user,
        lastMessageTime: lastMsg ? lastMsg.timestamp : user.createdAt,
        lastMessage: lastMsg ? lastMsg.text : ""
      };
    }));

    usersWithLastMsg.sort((a, b) => {
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.json(usersWithLastMsg);
  } catch (err) {
    console.error('Error fetching users with last message:', err);
    res.status(500).json({ error: "Failed to fetch users with last message" });
  }
});

// Get conversation
app.get("/api/conversation/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const adminEmail = ADMIN_CREDENTIALS.email;
    const limitNum = Math.min(Number(limit), 100);
    const offsetNum = Math.max(Number(offset), 0);
    
    const messages = await Message.find({
      $or: [
        { sender: userEmail, receiver: adminEmail },
        { sender: adminEmail, receiver: userEmail }
      ] 
    })
    .sort({ timestamp: 1 })
    .skip(offsetNum)
    .limit(limitNum)
    .lean()
    .exec();
    
    res.json({
      messages,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: messages.length === limitNum
      }
    });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Test admin endpoint
app.get("/api/test-admin", async (req, res) => {
  try {
    const adminUser = await User.findOne({ email: 'admin@chat.com' });
    if (adminUser) {
      res.json({ 
        exists: true, 
        user: {
          name: adminUser.name,
          email: adminUser.email,
          unreadCounts: adminUser.unreadCounts,
          isOnline: adminUser.isOnline
        }
      });
    } else {
      res.json({ exists: false, message: 'Admin user not found' });
    }
  } catch (err) {
    console.error('Error checking admin user:', err);
    res.status(500).json({ error: "Failed to check admin user" });
  }
});

// Serve React build files
if (ACTUAL_ENVIRONMENT === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// ===== SOCKET.IO HANDLERS =====
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id, "from:", socket.handshake.headers.origin);

  socket.userData = {};

  socket.on("user-online", async (data) => {
    try {
      socket.userData = data;
      
      await User.findOneAndUpdate(
        { email: data.email },
        { 
          isOnline: true,
          lastSeen: new Date()
        }
      );
      
      socket.broadcast.emit("user-online", data);
      console.log(`👤 User online: ${data.name} (${data.email})`);
    } catch (error) {
      console.error("Error updating user online status:", error);
    }
  });

  socket.on("user-offline", async (data) => {
    try {
      await User.findOneAndUpdate(
        { email: data.email },
        { 
          isOnline: false,
          lastSeen: new Date()
        }
      );
      
      socket.broadcast.emit("user-offline", data);
      console.log(`👤 User offline: ${data.name} (${data.email})`);
    } catch (error) {
      console.error("Error updating user offline status:", error);
    }
  });

  socket.on("send-message", async (data) => {
    try {
      const { sender, receiver, text, type = 'text', senderEmail } = data;
      
      if (!validateMessageData(data)) {
        socket.emit("message-error", { error: "Invalid message data" });
        return;
      }

      const messageCount = await Message.countDocuments({
        sender,
        timestamp: { $gte: new Date(Date.now() - 60000) }
      });

      if (messageCount >= 10) {
        socket.emit("message-error", { error: "Message rate limit exceeded" });
        return;
      }

      const newMessage = new Message({ 
        sender, 
        receiver, 
        text: text.trim(), 
        type,
        senderEmail,
        timestamp: new Date()
      });
      
      const saved = await newMessage.save();
      
      try {
        const receiverUser = await User.findOne({ email: receiver });
        if (receiverUser) {
          await receiverUser.incrementUnreadCount(sender);
          io.emit("unread-count-updated", {
            userEmail: receiver,
            senderEmail: sender,
            count: receiverUser.unreadCounts.get(sender) || 0
          });
        }
      } catch (unreadError) {
        console.error("Error updating unread count:", unreadError);
      }
      
      io.emit("receive-message", saved);
      
      console.log(`💬 Message sent: ${sender} → ${receiver}`);
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

  socket.on('message-delivered', async ({ messageId, to }) => {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.warn('Skipping delivery update for temp messageId:', messageId);
      return;
    }
    try {
      const message = await Message.findById(messageId);
      if (message) {
        await message.markAsDelivered();
        io.emit("message-delivered", { messageId });
      }
    } catch (error) {
      console.error("Error marking message as delivered:", error);
    }
  });

  socket.on("message-read", async (data) => {
    try {
      const { user, admin, messageId, sender, receiver } = data;
      
      if (messageId) {
        const message = await Message.findById(messageId);
        if (message) {
          await message.markAsRead();
          io.emit("message-read", { 
            messageId,
            sender: message.sender,
            receiver: message.receiver
          });
        }
      }
      
      if (admin && user) {
        const adminUser = await User.findOne({ email: admin });
        if (adminUser) {
          await adminUser.resetUnreadCount(user);
          io.emit("unread-count-reset", {
            userEmail: admin,
            senderEmail: user,
            count: 0
          });
        }
      }
    } catch (error) {
      console.error("Error handling message read:", error);
    }
  });

  socket.on("mark-conversation-read", async (data) => {
    try {
      const { userEmail, senderEmail } = data;
      
      const user = await User.findOne({ email: userEmail });
      if (user) {
        await user.resetUnreadCount(senderEmail);
        io.emit("unread-count-reset", {
          userEmail,
          senderEmail,
          count: 0
        });
      }
    } catch (error) {
      console.error("Error marking conversation as read:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🚪 User disconnected: ${socket.id} (${reason})`);
    if (socket.userData.email) {
      socket.broadcast.emit("user-offline", socket.userData);
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
    return res.status(400).json({ error: 'File upload error' });
  }

  if (err.message === 'Invalid file type. Only images and videos are allowed.') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: "GET /health",
      login: "POST /api/login",
      upload: "POST /api/upload",
      messages: "GET /api/messages",
      users: "GET /api/users"
    }
  });
});

// ===== PORT SELECTION =====
const getPort = () => {
  if (ACTUAL_ENVIRONMENT === 'production') {
    // On production server with SSL
    return server instanceof https.Server ? 443 : 80;
  } else {
    // Local development
    return process.env.PORT || 5000;
  }
};
const PORT = process.env.PORT || getPort();
server.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server running on localhost:${PORT}`);
  console.log(`🔗 Socket.IO ready for connections`);
  console.log(`🌐 Behind NGINX reverse proxy`);
  console.log("MongoDB URI:", process.env.MONGO_URI);
});

app.options("*", cors());
