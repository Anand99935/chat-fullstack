import './App.css';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Picker } from 'emoji-mart';
import { FaCheck, FaCheckDouble, FaRegSmile, FaMoon, FaSun, FaCircle, FaDownload, FaTimes, FaExpand, FaPlay } from 'react-icons/fa';

// Create Socket.IO instance with better configuration
const createSocket = () => {
  // const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000', {
  const socket = io("https://chats.dronanatural.com", {
    transports: ['websocket', 'polling'],
    path: "/api/socket.io/",
    withCredentials: true,
    // timeout: 20000,
    // reconnection: true,
    // reconnectionAttempts: 10,
    // reconnectionDelay: 1000,
    // autoConnect: true,
    // forceNew: false,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected successfully');
    console.log('Socket ID:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
  });

  return socket;
};

let socket;

// Media Modal Component
const MediaModal = ({ media, onClose, darkMode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media_${Date.now()}.${media.type === 'image' ? 'jpg' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setError(true);
  };

  if (!media) return null;

  return (
    <div className={`media-modal-overlay${darkMode ? ' dark' : ''}`} onClick={onClose}>
      <div className="media-modal-content" onClick={e => e.stopPropagation()}>
        <div className="media-modal-header">
          <button className="media-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
          <button className="media-modal-download" onClick={handleDownload}>
            <FaDownload />
          </button>
        </div>
        <div className="media-modal-body">
          {isLoading && (
            <div className="media-loading">
              <div className="loading-spinner"></div>
              <p>Loading media...</p>
            </div>
          )}
          {error && (
            <div className="media-error">
              <p>Failed to load media</p>
              <button onClick={() => window.open(media.url, '_blank')}>
                Open in new tab
              </button>
            </div>
          )}
          {media.type === 'image' ? (
            <img
              src={media.url}
              alt="Full size"
              className="media-modal-image"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: isLoading || error ? 'none' : 'block' }}
            />
          ) : (
            <video
              controls
              className="media-modal-video"
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              style={{ display: isLoading || error ? 'none' : 'block' }}
            >
              <source src={media.url} type="video/mp4" />
              <source src={media.url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>
    </div>
  );
};

// Media Message Component
const MediaMessage = ({ message, darkMode, onMediaClick }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setError(true);
  };

  const handleClick = () => {
    if (!error) {
      onMediaClick({
        url: message.text,
        type: message.type
      });
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = message.text;
    link.download = `media_${Date.now()}.${message.type === 'image' ? 'jpg' : 'mp4'}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isUrl = message.text && (message.text.startsWith('http://') || message.text.startsWith('https://'));

  if (!isUrl) {
    return <div className="text">{message.text}</div>;
  }

  return (
    <div className="media-message-container">
      {message.type === 'image' ? (
        <div 
          className="media-image-container"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
        >
          {isLoading && (
            <div className="media-loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
          {error && (
            <div className="media-error-overlay">
              <p>Image failed to load</p>
              <button onClick={() => window.open(message.text, '_blank')}>
                Open link
              </button>
            </div>
          )}
          <img
            src={message.text}
            alt="Chat media"
            className="chat-media"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: isLoading || error ? 'none' : 'block' }}
          />
          {isHovered && !isLoading && !error && (
            <div className="media-overlay">
              <button className="media-overlay-btn" onClick={handleDownload}>
                <FaDownload />
              </button>
              <button className="media-overlay-btn">
                <FaExpand />
              </button>
            </div>
          )}
        </div>
      ) : message.type === 'video' ? (
        <div 
          className="media-video-container"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
        >
          {isLoading && (
            <div className="media-loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
          {error && (
            <div className="media-error-overlay">
              <p>Video failed to load</p>
              <button onClick={() => window.open(message.text, '_blank')}>
                Open link
              </button>
            </div>
          )}
          <video
            className="chat-media"
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            style={{ display: isLoading || error ? 'none' : 'block' }}
          >
            <source src={message.text} type="video/mp4" />
            <source src={message.text} type="video/webm" />
            Your browser does not support the video tag.
          </video>
          {isHovered && !isLoading && !error && (
            <div className="media-overlay">
              <button className="media-overlay-btn" onClick={handleDownload}>
                <FaDownload />
              </button>
              <button className="media-overlay-btn">
                <FaPlay />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text">
          {isUrl ? (
            <a href={message.text} target="_blank" rel="noopener noreferrer" className="media-link">
              {message.text}
            </a>
          ) : (
            message.text
          )}
        </div>
      )}
    </div>
  );
};

function Loader() {
  return (
    <div className="upload-loader">
      <div className="loading-spinner"></div>
      <span>Uploading...</span>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="fullscreen-loader-overlay">
      <div className="fullscreen-loading-spinner"></div>
    </div>
  );
}

function App() {
  // State
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch {
      return false;
    }
  });
  const [onlineUsers, setOnlineUsers] = useState({});
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const chatBoxRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const PAGE_SIZE = 20;
  const isAdmin = (() => {
    try {
      return localStorage.getItem('isAdmin') === 'true';
    } catch {
      return false;
    }
  })();
  const trimmedSearch = searchTerm.trim().toLowerCase();

  // Initialize socket connection
  useEffect(() => {
    if (!socket) {
      socket = createSocket();
    }
    
    socket.on('connect', () => {
      setSocketConnected(true);
      console.log('Socket connected, ID:', socket.id);
      
      // Re-authenticate on reconnect
      if (loggedIn) {
        socket.emit('user-online', { email, name });
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      console.log('Socket disconnected');
    });

    return () => {
      if (socket) {
        socket.removeAllListeners();
      }
    };
  }, []);

  // Memoized sorted users (LIFO order)
  const sortedUsers = useMemo(() => {
    return users.sort((a, b) => {
      const aTime = lastMessages[a.name]?.time || a.createdAt;
      const bTime = lastMessages[b.name]?.time || b.createdAt;
      return new Date(bTime) - new Date(aTime);
    });
  }, [users, lastMessages]);

  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    return sortedUsers.filter(user => {
      const nameMatch = user.name?.toLowerCase().includes(trimmedSearch);
      const emailMatch = user.email?.toLowerCase().includes(trimmedSearch);
      const msgMatch = Array.isArray(chat) && chat.some(msg =>
        (msg.sender === user.name || msg.receiver === user.name) &&
        msg.text?.toLowerCase().includes(trimmedSearch)
      );
      return nameMatch || emailMatch || msgMatch;
    });
  }, [sortedUsers, trimmedSearch, chat]);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);
    }
  }, []);

  // Dark mode effect
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
    try {
      localStorage.setItem('darkMode', darkMode);
    } catch (e) {
      console.error('Failed to save dark mode preference:', e);
    }
  }, [darkMode]);

  useEffect(() => {
    scrollToBottom();
  }, [chat, selectedUser, scrollToBottom]);

  // Load user data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chatUser');
      if (stored) {
        const user = JSON.parse(stored);
        setName(user.name);
        setEmail(user.email);
        setLoggedIn(true);
      }
      
      const storedSelectedUser = localStorage.getItem('selectedUser');
      if (storedSelectedUser) {
        const parsed = JSON.parse(storedSelectedUser);
        setSelectedUser(parsed);
      }
      
      // Load chat messages from localStorage only if we have user context
      const storedChat = localStorage.getItem('chatMessages');
      if (storedChat && stored) {
        const parsed = JSON.parse(storedChat);
        setChat(parsed);
      }
      
      const storedLastMessages = localStorage.getItem('lastMessages');
      if (storedLastMessages) {
        const parsed = JSON.parse(storedLastMessages);
        const converted = {};
        Object.keys(parsed).forEach(key => {
          if (parsed[key] && parsed[key].time) {
            converted[key] = {
              ...parsed[key],
              time: new Date(parsed[key].time)
            };
          }
        });
        setLastMessages(converted);
      }
    } catch (err) {
      console.error('Failed to load from localStorage:', err);
      // Clear corrupted data
      localStorage.removeItem('chatUser');
      localStorage.removeItem('selectedUser');
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('lastMessages');
    }
  }, []);

  // Save data to localStorage with error handling
  useEffect(() => {
    if (selectedUser) {
      try {
        localStorage.setItem('selectedUser', JSON.stringify(selectedUser));
      } catch (e) {
        console.error('Failed to save selected user:', e);
      }
    } else {
      localStorage.removeItem('selectedUser');
    }
  }, [selectedUser]);

  useEffect(() => {
    if (Object.keys(lastMessages).length > 0) {
      try {
        localStorage.setItem('lastMessages', JSON.stringify(lastMessages));
      } catch (e) {
        console.error('Failed to save last messages:', e);
      }
    }
  }, [lastMessages]);

  // Save chat messages to localStorage
  useEffect(() => {
    if (chat.length > 0) {
      try {
        localStorage.setItem('chatMessages', JSON.stringify(chat));
      } catch (e) {
        console.error('Failed to save chat messages:', e);
      }
    }
  }, [chat]);

  // Unread counts sync
  useEffect(() => {
    if (isAdmin) {
      try {
        localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
      } catch (e) {
        console.error('Failed to save unread counts:', e);
      }
    }
  }, [unreadCounts, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      try {
        const stored = localStorage.getItem('unreadCounts');
        if (stored) setUnreadCounts(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load unread counts:', e);
      }
    }
  }, [isAdmin]);

  // Fetch users for admin
  useEffect(() => {
    if (loggedIn && isAdmin && socketConnected) {
      fetchUsers();
    }
  }, [loggedIn, isAdmin, socketConnected]);

  // Handle receive message - FIXED VERSION
  const handleReceiveMessage = useCallback((msg) => {
    console.log('Received message:', msg);
    
    setChat(prev => {
      // Check if message already exists
      const existingIndex = prev.findIndex(m => m._id === msg._id);
      if (existingIndex >= 0) {
        // Update existing message
        const updated = [...prev];
        updated[existingIndex] = { ...msg, status: msg.status || 'sent' };
        return updated;
      } else {
        // Add new message
        return [...prev, { ...msg, status: msg.status || 'sent' }];
      }
    });
    
    // Admin-specific handling
    if (isAdmin) {
      const { sender, text } = msg;
      const isChatOpen = selectedUser?.name === sender;
      
      // Update last messages
      setLastMessages(prev => ({
        ...prev,
        [sender]: { text, time: new Date() }
      }));
      
      // Update unread counts only if chat is not open
      if (!isChatOpen && msg.senderEmail) {
        setUnreadCounts(prev => ({ 
          ...prev, 
          [msg.senderEmail]: (prev[msg.senderEmail] || 0) + 1 
        }));
      }
      
      // Move user to top when they send a message (LIFO)
      if (msg.sender !== 'Admin') {
        setUsers(prev => {
          const updated = [...prev];
          const index = updated.findIndex(u => u.name === msg.sender);
          if (index > -1) {
            const [moved] = updated.splice(index, 1);
            return [moved, ...updated];
          }
          return updated;
        });
      }
    }
    
    // Auto-mark as read if chat is open
    if (selectedUser?.name === msg.sender && isAdmin) {
      setTimeout(() => {
        socket.emit('message-read', { 
          messageId: msg._id,
          user: selectedUser.name, 
          admin: name,
          sender: msg.sender,
          receiver: msg.receiver
        });
      }, 500);
    }
    
    // If user receives message and is not admin, mark as read
    if (!isAdmin && msg.receiver === name) {
      setTimeout(() => {
        socket.emit('message-read', { 
          messageId: msg._id,
          sender: msg.sender,
          receiver: msg.receiver
        });
      }, 500);
    }
  }, [selectedUser, isAdmin, name]);

  // Typing indicator handlers
  const handleTyping = useCallback(({ sender }) => {
    setTypingUser(sender);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
  }, []);

  const handleStopTyping = useCallback(() => {
    setIsTyping(false);
    setTypingUser('');
  }, []);

  const handleMessageError = useCallback(({ error }) => {
    setError(error);
    setTimeout(() => setError(''), 5000);
  }, []);

  // Online/offline handlers
  const handleUserOnline = useCallback(({ email }) => {
    setOnlineUsers(prev => ({ ...prev, [email]: true }));
  }, []);

  const handleUserOffline = useCallback(({ email }) => {
    setOnlineUsers(prev => {
      const updated = { ...prev };
      delete updated[email];
      return updated;
    });
  }, []);

  // Delivery/read status handlers
  const handleMessageDelivered = useCallback((data) => {
    setChat(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { ...msg, status: 'delivered', delivered: true }
        : msg
    ));
  }, []);
  
  const handleMessageRead = useCallback((data) => {
    setChat(prev => prev.map(msg => 
      msg._id === data.messageId 
        ? { ...msg, status: 'read', read: true }
        : msg
    ));
  }, []);

  // Unread count handlers
  const handleUnreadCountUpdated = useCallback(({ userEmail, senderEmail, count }) => {
    if (isAdmin && email === userEmail) {
      setUnreadCounts(prev => ({
        ...prev,
        [senderEmail]: count
      }));
    }
  }, [isAdmin, email]);

  const handleUnreadCountReset = useCallback(({ userEmail, senderEmail }) => {
    if (isAdmin && email === userEmail) {
      setUnreadCounts(prev => ({
        ...prev,
        [senderEmail]: 0
      }));
    }
  }, [isAdmin, email]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !socketConnected) return;

    // Remove existing listeners first
    socket.off('receive-message');
    socket.off('typing');
    socket.off('stop-typing');
    socket.off('message-error');
    socket.off('user-online');
    socket.off('user-offline');
    socket.off('message-delivered');
    socket.off('message-read');
    socket.off('unread-count-updated');
    socket.off('unread-count-reset');

    // Add event listeners
    socket.on('receive-message', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('message-error', handleMessageError);
    socket.on('user-online', handleUserOnline);
    socket.on('user-offline', handleUserOffline);
    socket.on('message-delivered', handleMessageDelivered);
    socket.on('message-read', handleMessageRead);
    socket.on('unread-count-updated', handleUnreadCountUpdated);
    socket.on('unread-count-reset', handleUnreadCountReset);

    // Notify server this user is online
    if (loggedIn) {
      socket.emit('user-online', { email, name });
    }

    return () => {
      if (socket) {
        socket.off('receive-message', handleReceiveMessage);
        socket.off('typing', handleTyping);
        socket.off('stop-typing', handleStopTyping);
        socket.off('message-error', handleMessageError);
        socket.off('user-online', handleUserOnline);
        socket.off('user-offline', handleUserOffline);
        socket.off('message-delivered', handleMessageDelivered);
        socket.off('message-read', handleMessageRead);
        socket.off('unread-count-updated', handleUnreadCountUpdated);
        socket.off('unread-count-reset', handleUnreadCountReset);
      }
    };
  }, [
    socketConnected, 
    loggedIn, 
    email, 
    name,
    handleReceiveMessage,
    handleTyping,
    handleStopTyping,
    handleMessageError,
    handleUserOnline,
    handleUserOffline,
    handleMessageDelivered,
    handleMessageRead,
    handleUnreadCountUpdated,
    handleUnreadCountReset
  ]);

  // Fetch messages when user/conversation changes
  useEffect(() => {
    if ((isAdmin && selectedUser) || (!isAdmin && loggedIn)) {
      fetchMessages(true);
      
      // Mark all as read when opening chat
      if (isAdmin && selectedUser) {
        socket.emit('message-read', { user: selectedUser.name, admin: name });
      }
    }
  }, [selectedUser, loggedIn, isAdmin]);

  // Scroll handling
  const handleScroll = useCallback((e) => {
    if (e.target.scrollTop === 0 && hasMore && !loading) {
      fetchMessages(false);
    }
  }, [hasMore, loading]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/users-with-last-message`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      
      setUsers(data);
      
      // Update lastMessages state with backend data
      const newLastMessages = {};
      data.forEach(user => {
        if (user.lastMessageTime) {
          newLastMessages[user.name] = {
            text: user.lastMessage || '',
            time: new Date(user.lastMessageTime)
          };
        }
      });
      setLastMessages(prev => ({ ...prev, ...newLastMessages }));
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    }
  };

  // Login function
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please enter both name and email');
      return;
    }
    
    setIsLoading(true);
    setError('');
    const isAdminLogin = name === 'Admin' && email === 'admin@chat.com';
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, isAdmin: isAdminLogin })
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        try {
          localStorage.setItem('chatUser', JSON.stringify(data.user));
          localStorage.setItem('isAdmin', isAdminLogin.toString());
        } catch (e) {
          console.error('Failed to save user data:', e);
        }
        
        setLoggedIn(true);
        setError('');
        
        // Emit user-online after socket is connected
        if (socket && socketConnected) {
          socket.emit('user-online', { email, name });
        }
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Server error while logging in');
    } finally {
      setIsLoading(false);
    }
  };   

  // File upload handler
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // File size validation (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadProgress(0);
    setError('');

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data?.url) {
              const messageData = {
                sender: name,
                receiver,
                text: data.url,
                type: file.type.startsWith('image') ? 'image' : 'video',
                fileName: file.name,
                fileSize: file.size,
                senderEmail: email
              };
              
              if (socket && socketConnected) {
                socket.emit('send-message', messageData);
                
                // Add to local chat immediately
                const tempMessage = {
                  ...messageData,
                  _id: Date.now().toString(),
                  status: 'sent',
                  timestamp: new Date()
                };
                setChat(prev => [...prev, tempMessage]);
              } else {
                setError('Connection lost. Please try again.');
              }
              
              setUploadProgress(0);
            }
          } catch (err) {
            console.error('Upload response parsing failed:', err);
            setError('Upload response parsing failed');
          }
        } else {
          setError('Upload failed');
        }
        setUploadProgress(0);
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed');
        setUploadProgress(0);
      });

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      xhr.open('POST', `${apiUrl}/upload`);
      xhr.send(formData);
      
    } catch (err) {
      console.error('File upload failed:', err);
      setError('File upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Typing input handler
  const handleTypingInput = useCallback(() => {
    if (!socket || !socketConnected) return;
    
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    socket.emit('typing', { sender: name, receiver });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { sender: name, receiver });
    }, 2000);
  }, [isAdmin, selectedUser, name, socketConnected]);

  // Send message function - FIXED VERSION
  const sendMessage = useCallback((text, type = 'text') => {
    if (!text.trim()) return;
    if (!socket || !socketConnected) {
      setError('Connection lost. Please try again.');
      return;
    }
    
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    const messageData = {
      sender: name,
      receiver,
      text: text.trim(),
      type,
      senderEmail: email,
      timestamp: new Date()
    };
    
    console.log('Sending message:', messageData);
    
    // Emit to server
    socket.emit('send-message', messageData);
    
    // Add to local chat immediately with temp ID
    const tempMessage = {
      ...messageData,
      _id: `temp_${Date.now()}`,
      status: 'sending',
      sent: true,
      delivered: false,
      read: false
    };
    
    setChat(prev => [...prev, tempMessage]);
    setMessage('');
    
    // Update last message for current user
    setLastMessages(prev => ({
      ...prev,
      [receiver]: { text: text.trim(), time: new Date() }
    }));
    
  }, [name, selectedUser, isAdmin, email, socketConnected]);

  // Fetch messages function
  const fetchMessages = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    
    try {
      const user1 = isAdmin ? name : 'Admin';
      const user2 = isAdmin ? selectedUser?.name : name;
      
      if (!user2) {
        setLoading(false);
        return;
      }
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      const response = await fetch(
        `${apiUrl}/messages?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}&limit=${PAGE_SIZE}&offset=${reset ? 0 : offset}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      
      const messages = data.messages || data;
      
      if (reset) {
        setChat(messages);
        setOffset(messages.length);
      } else {
        setChat(prev => [...messages, ...prev]);
        setOffset(prev => prev + messages.length);
      }
      setHasMore(messages.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread counts
  const fetchUnreadCounts = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/unread-counts/${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCounts(data.unreadCounts || {});
      }
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    }
  };

  // Mark conversation as read
  const markConversationAsRead = async (senderEmail) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email, senderEmail })
      });
      
      if (response.ok) {
        setUnreadCounts(prev => ({
          ...prev,
          [senderEmail]: 0
        }));
      }
    } catch (err) {
      console.error('Failed to mark conversation as read:', err);
    }
  };

  // Fetch unread counts on login
  useEffect(() => {
    if (loggedIn && isAdmin) {
      fetchUnreadCounts();
    }
  }, [loggedIn, isAdmin]);

  // Emoji picker
  const addEmoji = (emoji) => {
    setMessage(prev => prev + emoji.native);
  };

  // Media modal handlers
  const handleMediaClick = useCallback((media) => {
    setSelectedMedia(media);
  }, []);

  const closeMediaModal = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  // Helper functions
  const getMatchedMessage = useCallback((userName) => {
    const match = Array.isArray(chat) && chat.find(msg =>
      (msg.sender === userName || msg.receiver === userName) &&
      msg.text?.toLowerCase().includes(trimmedSearch)
    );
    return match?.text?.toLowerCase() || null;
  }, [chat, trimmedSearch]);

  const logout = useCallback(() => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
    
    setLoggedIn(false);
    setName('');
    setEmail('');
    setSelectedUser(null);
    setChat([]);
    setUsers([]);
    setUnreadCounts({});
    setLastMessages({});
    setError('');
    setSelectedMedia(null);
    setUploadProgress(0);
    
    if (socket && socketConnected) {
      socket.emit('user-offline', { email, name });
    }
  }, [email, name, socketConnected]);

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (isYesterday) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return '';
    }
  }, []);

  const highlightText = useCallback((text, term) => {
    if (!term || !text) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term ? <span key={i} className="highlight">{part}</span> : part
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Connection status indicator
  const connectionStatus = socketConnected ? 'Connected' : 'Connecting...';

  // Login UI
  if (!loggedIn) {
    return (
      <div className={`login-wrapper${darkMode ? ' dark' : ''}`}>
        <div className="login-card">
          <h2>Login to Chat</h2>
          {!socketConnected && (
            <div className="connection-status disconnected">
              {connectionStatus}
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={name}
              placeholder="Enter your name"
              onChange={e => setName(e.target.value)}
              required
            />
            <input
              type="email"
              value={email}
              placeholder="Enter your email"
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={isLoading || !socketConnected}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </div>
    );
  }

  // Admin users list UI
  if (isAdmin && !selectedUser) {
    return (
      <div className={`admin-users-list${darkMode ? ' dark' : ''}`}>
        <div className="admin-header">
          <h2>MyPursu Admin Panel</h2>
          <div className="admin-header-buttons">
            {!socketConnected && (
              <div className="connection-status disconnected">
                {connectionStatus}
              </div>
            )}
            <button className="logout-btn" onClick={logout}>Logout</button>
            <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
        <input
          type="text"
          placeholder="🔍 Search here..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <ul className="user-list">
          {filteredUsers.map((user, idx) => {
            const hasSearch = trimmedSearch.length > 0;
            const unread = unreadCounts[user.email] > 0;
            const matchedMsg = getMatchedMessage(user.name);
            const lastMsgObj = lastMessages[user.name];
            const lastMsgTime = lastMsgObj?.time ? formatTime(lastMsgObj.time) : '';
            const isOnline = onlineUsers[user.email];
            
            return (
              <li
                key={user._id || idx}
                className={`user-list-item${unread ? ' unread-user' : ''}`}
              >
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    markConversationAsRead(user.email);
                  }}
                  className="user-button"
                >
                  <div className="user-avatar">
                    {user.name?.charAt(0).toUpperCase()}
                    {isOnline && <FaCircle className="online-dot" color="green" size={10} />}
                  </div>
                  <div className="user-info">
                    <div className="user-name-with-badge">
                      <span className="user-name">{user.name}</span>
                      {unreadCounts[user.email] > 0 && (
                        <span className="badge">{unreadCounts[user.email]}</span>
                      )}
                    </div>
                    <div className="user-email">{user.email}</div>
                    {lastMsgTime && (
                      <div className="last-message-time">{lastMsgTime}</div>
                    )}
                    {hasSearch && matchedMsg && (
                      <div className="matched-message-preview">
                        {highlightText(matchedMsg, trimmedSearch)}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Main chat UI
  return (
    <>
      {isUploading && <FullScreenLoader />}
      <div className={`chat-container${darkMode ? ' dark' : ''}`}>
        <div className="chat-header">
          {isAdmin && selectedUser ? (
            <>
              <button className="back-button" onClick={() => setSelectedUser(null)}>
                ← Back
              </button>
              <h3>{selectedUser.name}</h3>
              {selectedUser.email && onlineUsers[selectedUser.email] && (
                <span className="online-status">
                  <FaCircle color="green" size={10} /> Online
                </span>
              )}
            </>
          ) : (
            <h3>💬 Chat with Mypursu</h3>
          )}
          <div className="header-buttons">
            {!socketConnected && (
              <div className="connection-status disconnected">
                {connectionStatus}
              </div>
            )}
            <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress">
            <div className="upload-progress-bar">
              <div 
                className="upload-progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <span>Uploading... {Math.round(uploadProgress)}%</span>
          </div>
        )}
        
        <div className="chat-box" ref={chatBoxRef} onScroll={handleScroll}>
          {hasMore && !loading && (
            <button onClick={() => fetchMessages(false)} className="load-more-btn">
              Load older messages
            </button>
          )}
          {loading && <div className="loading-indicator">Loading...</div>}
          
          {chat
            .filter((msg) => {
              if (isAdmin && selectedUser) {
                return (
                  (msg.sender === name && msg.receiver === selectedUser.name) ||
                  (msg.sender === selectedUser.name && msg.receiver === name)
                );
              } else if (!isAdmin) {
                return (
                  (msg.sender === name && msg.receiver === 'Admin') ||
                  (msg.sender === 'Admin' && msg.receiver === name)
                );
              }
              return false;
            })
            .map((msg, index) => (
              <div
                key={msg._id || index}
                className={`chat-bubble ${msg.sender === name ? 'you' : 'other'}`}
              >
                <div className="sender">{msg.sender}</div>
                <MediaMessage 
                  message={msg} 
                  darkMode={darkMode} 
                  onMediaClick={handleMediaClick}
                />
                <div className="msg-meta">
                  <span className="msg-time">
                    {formatTime(msg.time || msg.timestamp)}
                  </span>
                  {msg.sender === name && (
                    <span className="msg-status">
                      {msg.status === 'read' || msg.read ? (
                        <FaCheckDouble className="status-icon read" title="Read" />
                      ) : msg.status === 'delivered' || msg.delivered ? (
                        <FaCheckDouble className="status-icon delivered" title="Delivered" />
                      ) : msg.status === 'sending' ? (
                        <div className="sending-icon" title="Sending...">⏳</div>
                      ) : (
                        <FaCheck className="status-icon sent" title="Sent" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          
          {isTyping && typingUser && (
            <div className="typing-indicator">
              {typingUser} is typing...
            </div>
          )}
        </div>
        
        <div className="input-area">
          <input
            className="chat-input"
            placeholder={socketConnected ? "Type your message..." : "Connecting..."}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(message);
              }
            }}
            onInput={handleTypingInput}
            disabled={!socketConnected}
          />
          <button 
            className="emoji-btn" 
            onClick={() => setShowEmoji(e => !e)}
            disabled={!socketConnected}
          >
            <FaRegSmile />
          </button>
          {showEmoji && (
            <div className="emoji-picker">
              <Picker onSelect={addEmoji} theme={darkMode ? 'dark' : 'light'} />
            </div>
          )}
          {isUploading ? (
            <Loader />
          ) : (
            <>
              <label htmlFor="file-upload" className={`file-upload-label${!socketConnected ? ' disabled' : ''}`}>
                📎
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={!socketConnected}
              />
            </>
          )}
          <button 
            className="send-button" 
            onClick={() => sendMessage(message)}
            disabled={!socketConnected || !message.trim()}
          >
            ➤
          </button>
        </div>
        
        <div className="footer">
          <span className="user-label">User Name: {name}</span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
        
        {/* Media Modal */}
        {selectedMedia && (
          <MediaModal 
            media={selectedMedia} 
            onClose={closeMediaModal} 
            darkMode={darkMode}
          />
        )}
      </div>
    </>
  );
}

export default App;