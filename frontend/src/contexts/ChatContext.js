import { createContext, useState } from "react";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);

  return (
    <ChatContext.Provider value={{
      user, setUser,
      selectedChat, setSelectedChat,
      messages, setMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
};
