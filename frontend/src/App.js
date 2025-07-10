import './App.css';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { Picker } from 'emoji-mart';
// import 'emoji-mart/css/emoji-mart.css';
import { FaCheck, FaCheckDouble, FaRegSmile, FaMoon, FaSun, FaCircle, FaDownload, FaTimes, FaExpand, FaPlay } from 'react-icons/fa';

const createSocket = () => {
  const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
    transports: ['websocket'],
    withCredentials: true,
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  return socket;
};

const socket = createSocket();

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
    <div class="fullscreen-loader-overlay">
    <div class="fullscreen-loading-spinner"></div>
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [onlineUsers, setOnlineUsers] = useState({});
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const chatBoxRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const PAGE_SIZE = 20;
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const trimmedSearch = searchTerm.trim().toLowerCase();

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
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, []);

  // Dark mode effect
  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    scrollToBottom();
  }, [chat, selectedUser, scrollToBottom]);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('chatUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setName(user.name);
        setEmail(user.email);
        setLoggedIn(true);
      } catch (err) {
        localStorage.removeItem('chatUser');
      }
    }
    
    // Load selectedUser from localStorage
    const storedSelectedUser = localStorage.getItem('selectedUser');
    if (storedSelectedUser) {
      try {
        const parsed = JSON.parse(storedSelectedUser);
        setSelectedUser(parsed);
      } catch (err) {
        localStorage.removeItem('selectedUser');
      }
    }
    
    // Load chat messages from localStorage
    const storedChat = localStorage.getItem('chatMessages');
    if (storedChat) {
      try {
        const parsed = JSON.parse(storedChat);
        setChat(parsed);
      } catch (err) {
        localStorage.removeItem('chatMessages');
      }
    }
    
    // Load lastMessages from localStorage
    const storedLastMessages = localStorage.getItem('lastMessages');
    if (storedLastMessages) {
      try {
        const parsed = JSON.parse(storedLastMessages);
        // Convert string timestamps back to Date objects
        const converted = {};
        Object.keys(parsed).forEach(key => {
          converted[key] = {
            ...parsed[key],
            time: new Date(parsed[key].time)
          };
        });
        setLastMessages(converted);
      } catch (err) {
        localStorage.removeItem('lastMessages');
      }
    }
  }, []);

  // Save selectedUser to localStorage
  useEffect(() => {
    if (selectedUser) {
      localStorage.setItem('selectedUser', JSON.stringify(selectedUser));
    } else {
      localStorage.removeItem('selectedUser');
    }
  }, [selectedUser]);

  // Save lastMessages to localStorage
  useEffect(() => {
    if (Object.keys(lastMessages).length > 0) {
      localStorage.setItem('lastMessages', JSON.stringify(lastMessages));
    }
  }, [lastMessages]);

  // Unread counts sync
  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
    }
  }, [unreadCounts, isAdmin]);
  useEffect(() => {
    if (isAdmin) {
      const stored = localStorage.getItem('unreadCounts');
      if (stored) setUnreadCounts(JSON.parse(stored));
    }
  }, [isAdmin]);

  // Fetch users for admin
  useEffect(() => {
    if (loggedIn && isAdmin) fetchUsers();
  }, [loggedIn, isAdmin]);

  // Socket event listeners
  useEffect(() => {
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
    if (loggedIn) socket.emit('user-online', { email, name });

    return () => {
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
      if (loggedIn) socket.emit('user-offline', { email, name });
    };
    // eslint-disable-next-line
  }, [isAdmin, selectedUser, name, email, loggedIn]);

  // Fetch messages when user/conversation changes
  useEffect(() => {
    if ((isAdmin && selectedUser) || (!isAdmin && loggedIn)) {
      fetchMessages(true);
      // Mark all as read when opening chat
      if (isAdmin && selectedUser) {
        socket.emit('message-read', { user: selectedUser.name, admin: name });
      }
    }
    // eslint-disable-next-line
  }, [selectedUser, loggedIn, isAdmin]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/users-with-last-message`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      
      // Data is already sorted by last message time (LIFO)
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
      setError('Failed to load users');
    }
  };

  // Handle receive message
  const handleReceiveMessage = useCallback((msg) => {
    setChat(prev => {
      // Replace temp message if matching (by sender, text, and close timestamp)
      const tempIndex = prev.findIndex(m =>
        m.sender === msg.sender &&
        m.text === msg.text &&
        Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 2000 &&
        String(m._id).length < 20 // temp id is Date.now()
      );
      if (tempIndex >= 0) {
        const updated = [...prev];
        updated[tempIndex] = { ...msg, status: msg.status || 'sent' };
        return updated;
      }
      // Otherwise, normal update logic
      const existingIndex = prev.findIndex(m => m._id === msg._id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...msg, status: msg.status || 'sent' };
        return updated;
      } else {
        return [...prev, { ...msg, status: msg.status || 'sent' }];
      }
    });
    
    // Admin-specific handling
    if (isAdmin) {
      const { sender, text } = msg;
      const isChatOpen = selectedUser?.name === sender;
      
      // Update last messages with current timestamp
      setLastMessages(prev => ({
        ...prev,
        [sender]: { text, time: new Date() }
      }));
      
      // Update unread counts only if chat is not open
      if (!isChatOpen) {
        setUnreadCounts(prev => ({ ...prev, [msg.senderEmail]: (prev[msg.senderEmail] || 0) + 1 }));
      }
      
      // ALWAYS move user to top when they send a message (LIFO)
      if (msg.sender !== 'Admin') {
        setUsers(prev => {
          const updated = [...prev];
          const index = updated.findIndex(u => u.name === msg.sender);
          if (index > -1) {
            // Remove user from current position
            const [moved] = updated.splice(index, 1);
            // Add to top
            return [moved, ...updated];
          }
          return updated;
        });
      }
    }
    
    // If message is from current chat, mark as read
    if (msg.sender === selectedUser?.name && isAdmin) {
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
  }, [selectedUser, isAdmin, name, socket]);

  // Typing indicator
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

  // Online/offline
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

  // Delivery/read status
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

  // Scroll/load more
  const handleScroll = useCallback((e) => {
    if (e.target.scrollTop === 0 && hasMore && !loading) {
      fetchMessages(false);
    }
  }, [hasMore, loading]);

  // Login
  const handleLogin = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Please enter both name and email');
      return;
    }
    setIsLoading(true);
    setError('');
    const isAdminLogin = name === 'Admin' && email === 'admin@chat.com';
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, isAdmin: isAdminLogin })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem('chatUser', JSON.stringify(data.user));
        localStorage.setItem('isAdmin', isAdminLogin.toString());
        setLoggedIn(true);
        setError('');
        socket.emit('user-online', { email, name });
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Server error while logging in');
    } finally {
      setIsLoading(false);
    }
  };

  // File upload with progress
  const handleFileChange = async (e) => {
    setIsUploading(true);
    const file = e.target.files[0];
    if (!file) {
      setIsUploading(false);
      return;
    }

    // File size validation (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File size must be less than 10MB');
      setIsUploading(false);
      return;
    }

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
              socket.emit('send-message', {
                sender: name,
                receiver,
                text: data.url,
                type: file.type.startsWith('image') ? 'image' : 'video',
                fileName: file.name,
                fileSize: file.size,
                senderEmail: email
              });
              setUploadProgress(0);
            }
          } catch (err) {
            setError('Upload response parsing failed');
            setUploadProgress(0);
          }
        } else {
          setError('Upload failed');
          setUploadProgress(0);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed');
        setUploadProgress(0);
      });

      xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/upload`);
      xhr.send(formData);
    } catch (err) {
      setError("File upload failed");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Typing
  const handleTypingInput = useCallback(() => {
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    socket.emit('typing', { sender: name, receiver });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { sender: name, receiver });
    }, 2000);
  }, [isAdmin, selectedUser, name]);

  // Send message
  const sendMessage = useCallback((text, type = 'text') => {
    if (!text.trim()) return;
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    const messageData = {
      sender: name,
      receiver,
      text: text.trim(),
      type,
      senderEmail: email,
      timestamp: new Date()
    };
    socket.emit("send-message", messageData);
    const tempMessage = {
      ...messageData,
      _id: Date.now().toString(),
      status: 'sent',
      sent: true,
      delivered: false,
      read: false
    };
    setChat(prev => [...prev, tempMessage]);
    setMessage(''); // clear input after sending
    setTimeout(() => {
      socket.emit('message-delivered', {
        messageId: tempMessage._id,
        to: receiver
      });
    }, 1000);
  }, [name, selectedUser, isAdmin, socket, email]);

  // Fetch messages
  const fetchMessages = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const user1 = isAdmin ? name : 'Admin';
      const user2 = isAdmin ? selectedUser?.name : name;
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/messages?user1=${user1}&user2=${user2}&limit=${PAGE_SIZE}&offset=${reset ? 0 : offset}`
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      
      // Handle the response structure properly
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
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

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

  // Helpers
  const getMatchedMessage = useCallback((userName) => {
    const match = Array.isArray(chat) && chat.find(msg =>
      (msg.sender === userName || msg.receiver === userName) &&
      msg.text?.toLowerCase().includes(trimmedSearch)
    );
    return match?.text?.toLowerCase() || null;
  }, [chat, trimmedSearch]);

  const logout = useCallback(() => {
    localStorage.clear();
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
    socket.emit('user-offline', { email, name });
  }, [email, name]);

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return '';
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
  }, []);

  const highlightText = useCallback((text, term) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term ? <span key={i} className="highlight">{part}</span> : part
    );
  }, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Fetch unread counts on login
  useEffect(() => {
    if (loggedIn) {
      fetchUnreadCounts();
    }
  }, [loggedIn]);

  // Fetch unread counts from database
  const fetchUnreadCounts = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/unread-counts/${email}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCounts(data.unreadCounts || {});
      }
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    }
  };

  // Unread count updated from socket
  const handleUnreadCountUpdated = useCallback(({ userEmail, senderEmail, count }) => {
    // Only update if this user is admin and logged in
    if (isAdmin && email === userEmail) {
      setUnreadCounts(prev => ({
        ...prev,
        [senderEmail]: count
      }));
    }
  }, [isAdmin, email]);

  // Unread count reset from socket
  const handleUnreadCountReset = useCallback(({ userEmail, senderEmail, count }) => {
    if (isAdmin && email === userEmail) {
      setUnreadCounts(prev => ({
        ...prev,
        [senderEmail]: 0
      }));
    }
  }, [isAdmin, email]);

  // Mark conversation as read
  const markConversationAsRead = async (senderEmail) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/mark-read`, {
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

  // Save chat messages to localStorage
  useEffect(() => {
    if (chat.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(chat));
    } else {
      localStorage.removeItem('chatMessages');
    }
  }, [chat]);

  // UI
  if (!loggedIn) {
    return (
      <div className={`login-wrapper${darkMode ? ' dark' : ''}`}>
        <div className="login-card">
          <h2>Login to Chat</h2>
          {error && <div className="error-message">{error}</div>}
          <input
            type="text"
            value={name}
            placeholder="Enter your name"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <input
            type="email"
            value={email}
            placeholder="Enter your email"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin && !selectedUser) {
    return (
      <div className={`admin-users-list${darkMode ? ' dark' : ''}`}>
        <div className="admin-header">
          <h2>MyPursu Admin Panel</h2>
          <div className="admin-header-buttons">
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
                    // Mark conversation as read when admin opens chat
                    markConversationAsRead(user.email);
                    // setUnreadCounts(prev => ({ ...prev, [user.email]: 0 }));
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
                      {unreadCounts[user.email] > 0 && <span className="badge">{unreadCounts[user.email]}</span>}
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

  return (
    <>
      {isUploading && <FullScreenLoader />}
      <div className={`chat-container${darkMode ? ' dark' : ''}`}>
        <div className="chat-header">
          {isAdmin && selectedUser ? (
            <>
              <button className="back-button" onClick={() => setSelectedUser(null)}>← Back</button>
              <h3>{selectedUser.name}</h3>
              {selectedUser.email && onlineUsers[selectedUser.email] && (
                <span className="online-status"><FaCircle color="green" size={10} /> Online</span>
              )}
            </>
          ) : (
            <h3>💬 Chat with Mypursu</h3>
          )}
          <div className="header-buttons">
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
                  <span className="msg-time">{formatTime(msg.time || msg.timestamp)}</span>
                  {/* Enhanced Delivery/Read status */}
                  {msg.sender === name && (
                    <span className="msg-status">
                      {msg.status === 'read' || msg.read ? (
                        <FaCheckDouble className="status-icon read" title="Read" />
                      ) : msg.status === 'delivered' || msg.delivered ? (
                        <FaCheckDouble className="status-icon delivered" title="Delivered" />
                      ) : (
                        <FaCheck className="status-icon sent" title="Sent" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          }
          {isTyping && typingUser && (
            <div className="typing-indicator">
              {typingUser} is typing...
            </div>
          )}
        </div>
        <div className="input-area">
          <input
            className="chat-input"
            placeholder="Type your message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(message)}
            onInput={handleTypingInput}
          />
          {/* <button className="emoji-btn" onClick={() => setShowEmoji(e => !e)}>
            <FaRegSmile />
          </button> */}
          {showEmoji && (
            <div className="emoji-picker">
              <Picker onSelect={addEmoji} theme={darkMode ? 'dark' : 'light'} />
            </div>
          )}
          {isUploading ? (
            <Loader />
          ) : (
            <>
              <label htmlFor="file-upload" className="file-upload-label">
                📎
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </>
          )}
          <button className="send-button" onClick={() => sendMessage(message)}>➤</button>
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