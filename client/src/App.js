import './App.css';
import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io(process.env.REACT_APP_API_URL, {
  transports: ['websocket'],
  withCredentials: true,
});

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
  // const [file, setFile] = useState(null);
  const chatBoxRef = useRef(null);

  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const trimmedSearch = searchTerm.trim().toLowerCase();

  // Auto scroll to bottom
  const scrollToBottom = () => {
    const chatBox = chatBoxRef.current;
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  };

  useEffect(scrollToBottom, [chat, selectedUser]);

  useEffect(() => {
    const stored = localStorage.getItem('chatUser');
    if (stored) {
      const user = JSON.parse(stored);
      setName(user.name);
      setEmail(user.email);
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (loggedIn && isAdmin) {
      fetch(`${process.env.REACT_APP_API_URL}/api/users`)
        .then(res => res.json())
        .then(data => setUsers(data.filter(u => u.name !== 'Admin')))
        .catch(console.error);
    }
  }, [loggedIn, isAdmin]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/messages`)
      .then(res => res.json())
      .then(setChat);

    socket.on('receive-message', (msg) => {
      setChat(prev => [...prev, msg]);

      if (isAdmin) {
        const { sender, text } = msg;
        const isChatOpen = selectedUser?.name === sender;

        if (!isChatOpen) {
          setUnreadCounts(prev => ({ ...prev, [sender]: (prev[sender] || 0) + 1 }));
        }

        setLastMessages(prev => ({ ...prev, [sender]: text }));

        setUsers(prev => {
          const updated = [...prev];
          const index = updated.findIndex(u => u.name === sender);
          if (index > -1) {
            const [moved] = updated.splice(index, 1);
            return [moved, ...updated];
          }
          return updated;
        });
      }
    });

    return () => socket.off('receive-message');
  }, [isAdmin, selectedUser]);

  const handleLogin = async () => {
    if (!name.trim() || !email.trim()) return alert('Please enter both name and email');

    const isAdminLogin = name === 'Admin' && email === 'admin@chat.com';

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, isAdmin: isAdminLogin })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('chatUser', JSON.stringify(data.user));
        localStorage.setItem('isAdmin', isAdminLogin.toString());
        setLoggedIn(true);
      } else {
        alert('Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Server error while logging in');
    }
  };
const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data?.url) {
      socket.emit('send-message', {
        sender: name,
        receiver,
        text: data.url,
        type: file.type.startsWith('image') ? 'image' : 'video'
      });
    }
  } catch (err) {
    alert("File upload failed");
    console.error(err);
  }
};

  const sendMessage = () => {
    if (!message.trim()) return;

    const receiver = isAdmin && selectedUser ? selectedUser.name : 'Admin';
    socket.emit('send-message', { sender: name, text: message, receiver });
    setMessage('');
  };

  const highlightText = (text, term) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === term ? <span key={i} className="highlight">{part}</span> : part
    );
  };

  const getMatchedMessage = (userName) => {
    const match = chat.find(msg =>
      (msg.sender === userName || msg.receiver === userName) &&
      msg.text?.toLowerCase().includes(trimmedSearch)
    );
    return match?.text?.toLowerCase() || null;
  };

  const filteredUsers = users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(trimmedSearch);
    const emailMatch = user.email?.toLowerCase().includes(trimmedSearch);
    const msgMatch = chat.some(msg =>
      (msg.sender === user.name || msg.receiver === user.name) &&
      msg.text?.toLowerCase().includes(trimmedSearch)
    );
    return nameMatch || emailMatch || msgMatch;
  });

  const logout = () => {
    localStorage.clear();
    setLoggedIn(false);
    setName('');
    setEmail('');
  };

  if (!loggedIn) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h2>Login to Chat</h2>
          <input type="text" value={name} placeholder="Enter your name" onChange={e => setName(e.target.value)} />
          <input type="email" value={email} placeholder="Enter your email" onChange={e => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
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

        <input
          type="text"
          placeholder="🔍 Search here..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
<ul className="user-list">
  {filteredUsers.map((user, idx) => {
    // const lastMsg = lastMessages[user.name];
    const hasSearch = trimmedSearch.length > 0;
    const unread = unreadCounts[user.name] > 0;
    const matchedMsg = getMatchedMessage(user.name); 
    return (
      <li key={idx} className="user-list-item">
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
            {/* Show matched message preview if searching and match found */}
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
            <h3>Chatting with : {selectedUser.name}</h3>
          </>
        ) : (
          <h3>💬 Chat with Mypursu</h3>
        )}
      </div>

     <div className="chat-box" ref={chatBoxRef}>
  {chat
    .filter((msg) => {
      if (isAdmin && selectedUser) {
        // Admin view: show chat with selected user only
        return (
          (msg.sender === name && msg.receiver === selectedUser.name) ||
          (msg.sender === selectedUser.name && msg.receiver === name)
        );
      } else if (!isAdmin) {
        // User view: show only chat with Admin
        return (
          (msg.sender === name && msg.receiver === 'Admin') ||
          (msg.sender === 'Admin' && msg.receiver === name)
        );
      }
      return false; // Edge fallback
    })
    .map((msg, index) => (
      <div
        key={index}
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
      </div>
    ))}
</div>


      <div className="input-area">
        <input
          className="chat-input"
          placeholder="Type your message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
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
        <span className="user-label">User Name : {name}</span>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}

export default App;
