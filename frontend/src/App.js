import './App.css';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// Socket connection with error handling
const createSocket = () => {
  const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
    transports: ['websocket'],
    withCredentials: true,
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
  });

  return socket;
};

const socket = createSocket();

function App() {
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

  const chatBoxRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const PAGE_SIZE = 20;
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const trimmedSearch = searchTerm.trim().toLowerCase();

  // Memoized values
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const nameMatch = user.name?.toLowerCase().includes(trimmedSearch);
      const emailMatch = user.email?.toLowerCase().includes(trimmedSearch);
      const msgMatch = chat.some(msg =>
        (msg.sender === user.name || msg.receiver === user.name) &&
        msg.text?.toLowerCase().includes(trimmedSearch)
      );
      return nameMatch || emailMatch || msgMatch;
    });
  }, [users, trimmedSearch, chat]);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, []);

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
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('chatUser');
      }
    }
  }, []);

  // Fetch users for admin
  useEffect(() => {
    if (loggedIn && isAdmin) {
      fetchUsers();
    }
  }, [loggedIn, isAdmin]);

  // Socket event listeners
  useEffect(() => {
    socket.on('receive-message', handleReceiveMessage);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('message-error', handleMessageError);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('typing', handleTyping);
      socket.off('stop-typing', handleStopTyping);
      socket.off('message-error', handleMessageError);
    };
  }, [isAdmin, selectedUser, name]);

  // Fetch messages when user/conversation changes
  useEffect(() => {
    if ((isAdmin && selectedUser) || (!isAdmin && loggedIn)) {
      fetchMessages(true);
    }
  }, [selectedUser, loggedIn, isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.filter(u => u.name !== 'Admin'));
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    }
  };

  const handleReceiveMessage = useCallback((msg) => {
    // Only add to chat if relevant
    if (
      (isAdmin && selectedUser && (msg.sender === selectedUser.name || msg.receiver === selectedUser.name)) ||
      (!isAdmin && (msg.sender === name || msg.receiver === name))
    ) {
      setChat(prev => [...prev, msg]);
    }

    if (isAdmin) {
      const { sender, text } = msg;
      const isChatOpen = selectedUser?.name === sender;

      setLastMessages(prev => ({
        ...prev,
        [sender]: { text }
      }));

      if (!isChatOpen) {
        setUnreadCounts(prev => ({ ...prev, [sender]: (prev[sender] || 0) + 1 }));
      }

      setUsers(prev => {
        const updated = [...prev];
        let userNameToMove;
        if (msg.sender === 'Admin') {
          userNameToMove = msg.receiver;
        } else {
          userNameToMove = msg.sender;
        }
        const index = updated.findIndex(u => u.name === userNameToMove);
        if (index > -1) {
          const [moved] = updated.splice(index, 1);
          return [moved, ...updated];
        }
        return updated;
      });
    }
  }, [isAdmin, selectedUser, name]);

  const handleTyping = useCallback(({ sender }) => {
    setTypingUser(sender);
    setIsTyping(true);
  }, []);

  const handleStopTyping = useCallback(() => {
    setIsTyping(false);
    setTypingUser('');
  }, []);

  const handleMessageError = useCallback(({ error }) => {
    setError(error);
    setTimeout(() => setError(''), 5000);
  }, []);

  const handleScroll = useCallback((e) => {
    if (e.target.scrollTop === 0 && hasMore && !loading) {
      fetchMessages(false);
    }
  }, [hasMore, loading]);

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data?.url) {
        socket.emit('send-message', {
          sender: name,
          receiver,
          text: data.url,
          type: file.type.startsWith('image') ? 'image' : 'video'
        });
      }
    } catch (err) {
      setError("File upload failed");
      console.error(err);
    }
  };

  const handleTyping = useCallback(() => {
    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    socket.emit('typing', { sender: name, receiver });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', { sender: name, receiver });
    }, 2000);
  }, [isAdmin, selectedUser, name]);

  const sendMessage = useCallback(() => {
    if (!message.trim()) return;

    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    socket.emit('send-message', { sender: name, text: message, receiver });
    setMessage('');
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('stop-typing', { sender: name, receiver });
  }, [message, isAdmin, selectedUser, name]);

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

      if (reset) {
        setChat(data);
        setOffset(data.length);
      } else {
        setChat(prev => [...data, ...prev]);
        setOffset(prev => prev + data.length);
      }

      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const getMatchedMessage = useCallback((userName) => {
    const match = chat.find(msg =>
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
  }, []);

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
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  if (!loggedIn) {
    return (
      <div className="login-wrapper">
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
        </div>
      </div>
    );
  }

  if (isAdmin && !selectedUser) {
    return (
      <div className="admin-users-list">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button className="logout-btn" onClick={logout}>Logout</button>
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
            const unread = unreadCounts[user.name] > 0;
            const matchedMsg = getMatchedMessage(user.name); 
            const lastMsgObj = lastMessages[user.name];
            const lastMsgTime = lastMsgObj?.time ? formatTime(lastMsgObj.time) : '';
            
            return (
              <li key={user._id || idx} className="user-list-item">
                <button
                  onClick={() => {
                    setSelectedUser(user);
                    setUnreadCounts(prev => ({ ...prev, [user.name]: 0 }));
                  }}
                  className="user-button"
                >
                  <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                  <div className="user-info">
                    <div className="user-name-with-badge">
                      <span className="user-name">{user.name}</span>
                      {unread && <span className="badge">{unreadCounts[user.name]}</span>}
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
    <div className="chat-container">
      <div className="chat-header">
        {isAdmin && selectedUser ? (
          <>
            <button className="back-button" onClick={() => setSelectedUser(null)}>← Back</button>
            <h3>Chatting with: {selectedUser.name}</h3>
          </>
        ) : (
          <h3>💬 Chat with Mypursu</h3>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

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
              <div className="text">
                {msg.type === 'image' ? (
                  <img src={msg.text} alt="uploaded" className="chat-media" />
                ) : msg.type === 'video' ? (
                  <video controls className="chat-media">
                    <source src={msg.text} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  msg.text
                )}
              </div>
              <div className="msg-time">{formatTime(msg.time || msg.timestamp)}</div>
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
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          onInput={handleTyping}
        />
        
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

        <button className="send-button" onClick={sendMessage}>➤</button>
      </div>

      <div className="footer">
        <span className="user-label">User Name: {name}</span>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}

export default App;
