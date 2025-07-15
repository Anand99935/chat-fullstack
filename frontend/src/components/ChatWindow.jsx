import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import MessageBubble from "./MessageBubble";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
const socket = io(API_URL);

const ChatWindow = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, { text: data, isOwn: false }]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() !== "") {
      setMessages((prev) => [...prev, { text: message, isOwn: true }]);
      socket.emit("send_message", message);
      setMessage("");
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg.text} isOwn={msg.isOwn} />
        ))}
      </div>
      <div className="flex border-t p-2">
        <input
          type="text"
          className="flex-1 border rounded px-4 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 ml-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
