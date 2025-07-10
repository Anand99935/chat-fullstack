require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const Message = require('./models/message');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);

// Enhanced Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// CORS configuration with better security
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-system-5.onrender.com",
  "https://*onrender.com",
  "http://143.110.248.0:3000",
   "http://143.110.248.0:5000",
  
  process.env.FRONTEND_URL
].filter(Boolean);

// Enhanced Rate limiting with different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: { error: 'Too many upload attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware with better limits
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

// Admin credentials from environment variables
const ADMIN_CREDENTIALS = {
  name: process.env.ADMIN_NAME || 'Admin',
  email: process.env.ADMIN_EMAIL || 'admin@chat.com'
};

// Enhanced Cloudinary configuration with error handling
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtmfrtwy4',
  api_key: process.env.CLOUDINARY_API_KEY || '629516584655468',
  api_secret: process.env.CLOUDINARY_API_SECRET || '8k-EvIFA-ZcNDI-Po1M-8J6oQKw'
});

// Enhanced storage configuration with better file validation
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

// Enhanced multer configuration with better file filtering
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

// Input validation middleware
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateMessageData = (data) => {
  const { sender, receiver, text } = data;
  return sender && receiver && text && text.trim().length > 0;
};

// Enhanced File upload endpoint with better error handling
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Additional validation
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

// Health check endpoint with more details
app.get("/health", (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  res.json(health);
});

// Enhanced Login route with better validation
app.post('/api/login', async (req, res) => {
  try {
    let { name, email, isAdmin } = req.body;
    
    // Input validation
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

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(200).json({ success: true, user: existingUser });
    }

    // Create new user
    const newUser = new User({ name, email });
    const savedUser = await newUser.save();
    return res.status(201).json({ success: true, user: savedUser });

  } catch (err) {
    console.error("❌ Login DB error:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enhanced MongoDB connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://businesskeyutech:86vT98mp3O1oJmM0@cluster0.ramskda.mongodb.net/chatapp?retryWrites=true&w=majority';

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
    await
    //  mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    // process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
});

// API Routes
app.get("/", (req, res) => {
  res.json({ 
    message: "💬 Chat backend is running...", 
    version: "1.0.0",
    endpoints: {
      health: "/health",
      login: "/api/login",
      upload: "/api/upload",
      messages: "/api/messages",
      users: "/api/users"
    }
  });
});

// Enhanced Get messages with pagination and caching
app.get('/api/messages', async (req, res) => {
  try {
    const { user1, user2, limit = 20, offset = 0 } = req.query;
    
    // Input validation
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'user1 and user2 parameters are required' });
    }

    const limitNum = Math.min(Number(limit), 100); // Max 100 messages per request
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

// Enhanced Get all users with pagination
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

// Get unread counts for a user
app.get("/api/unread-counts/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Handle admin user case
    if (userEmail === ADMIN_CREDENTIALS.email) {
      return res.json({ unreadCounts: {} });
    }

    const user = await User.findOne({ email: userEmail }, "unreadCounts").lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle case where unreadCounts might not be initialized
    let unreadCounts = {};
    if (user.unreadCounts && user.unreadCounts instanceof Map) {
      // Convert Map to object for JSON response
      for (let [key, value] of user.unreadCounts) {
        unreadCounts[key] = value;
      }
    } else if (user.unreadCounts && typeof user.unreadCounts === 'object') {
      // If it's already an object (from lean query)
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

// Get total unread count for a user
app.get("/api/total-unread/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;
    
    if (!validateEmail(userEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Handle admin user case
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

// Get users with last message times for admin panel
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

    // Sort by last message time (LIFO)
    usersWithLastMsg.sort((a, b) => {
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.json(usersWithLastMsg);
  } catch (err) {
    console.error('Error fetching users with last message:', err);
    res.status(500).json({ error: "Failed to fetch users with last message" });
  }
});

// Enhanced Get conversation between admin and user
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

// Enhanced Socket.IO setup with better configuration
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  maxHttpBufferSize: 1e8 // 100MB
});

// Socket.IO connection handling with enhanced features
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // Store user information
  socket.userData = {};

  socket.on("user-online", async (data) => {
    try {
      socket.userData = data;
      
      // Update user's online status in database
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
      // Update user's offline status in database
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
      
      // Enhanced validation
      if (!validateMessageData(data)) {
        socket.emit("message-error", { error: "Invalid message data" });
        return;
      }

      // Rate limiting for messages (max 10 messages per minute per user)
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
        senderEmail, // Add sender email for admin panel
        timestamp: new Date()
      });
      
      const saved = await newMessage.save();
      
      // Update unread count for receiver
      try {
        const receiverUser = await User.findOne({ email: receiver });
        if (receiverUser) {
          await receiverUser.incrementUnreadCount(sender);
          // Emit updated unread count to receiver
          io.emit("unread-count-updated", {
            userEmail: receiver,
            senderEmail: sender,
            count: receiverUser.unreadCounts.get(sender) || 0
          });
        }
      } catch (unreadError) {
        console.error("Error updating unread count:", unreadError);
      }
      
      // Emit to all connected clients
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

  socket.on("message-delivered", async (data) => {
    try {
      const { messageId, to } = data;
      
      // Update message status in database
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
      
      // Mark specific message as read if messageId is provided
      if (messageId) {
        const message = await Message.findById(messageId);
        if (message) {
          await message.markAsRead();
          // Emit to all clients so both sender and receiver see blue ticks
          io.emit("message-read", { 
            messageId,
            sender: message.sender,
            receiver: message.receiver
          });
        }
      }
      
      // Reset unread count when admin opens chat with user
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

// Enhanced Error handling middleware
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

// Enhanced 404 handler
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

// Server start with better error handling
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: ${process.env.NODE_ENV === 'production' ? 'Enabled' : 'Development mode'}`);
  console.log(`💾 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Test endpoint to check admin user
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