import React, { useState, useEffect } from "react";
import axios from "axios";
import io from "socket.io-client";
import UserList from "./UserList";
import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

const socket = io("http://localhost:5000");

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) fetchMessages(selectedUser);
  }, [selectedUser]);

  useEffect(() => {
    socket.on("receive-message", (message) => {
      if (
        message.sender === selectedUser ||
        message.receiver === selectedUser
      ) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => socket.off("receive-message");
  }, [selectedUser]);

  const fetchUsers = async () => {
    const res = await axios.get("http://localhost:5000/users");
    setUsers(res.data);
  };

  const fetchMessages = async (user) => {
    const res = await axios.get(`http://localhost:5000/messages/${user}`);
    setMessages(res.data);
  };

  const sendMessage = async (text) => {
    const message = {
      sender: "admin",
      receiver: selectedUser,
      text,
    };
    socket.emit("send-message", message);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      <UserList users={users} setSelectedUser={setSelectedUser} selectedUser={selectedUser} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatWindow messages={messages} currentUser="admin" />
        {selectedUser && <MessageInput onSend={sendMessage} />}
      </div>
    </div>
  );
}

export default AdminPanel;
