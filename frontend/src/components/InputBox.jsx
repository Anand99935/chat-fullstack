import React, { useState, useContext } from "react";
import { ChatContext } from "../contexts/ChatContext";

const InputBox = () => {
  const [text, setText] = useState("");
  const { messages, setMessages } = useContext(ChatContext);

  const sendMessage = () => {
    if (!text.trim()) return;
    const newMessage = { content: text };
    setMessages([...messages, newMessage]);
    setText("");
  };

  return (
    <div className="mt-4 flex">
      <input
        type="text"
        className="flex-1 border rounded p-2 mr-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage} className="bg-blue-500 text-white px-4 py-2 rounded">
        Send
      </button>
    </div>
  );
};

export default InputBox;
