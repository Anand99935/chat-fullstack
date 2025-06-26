import React, { useContext } from "react";
import { ChatContext } from "../contexts/ChatContext";

const dummyChats = [
  { id: 1, name: "I am Ginni" },
  // { id: 2, name: "Alice" },
];

const Sidebar = () => {
  const { setSelectedChat } = useContext(ChatContext);

  return (
    <div className="w-1/3 bg-gray-100 p-4">
      <h2 className="text-xl font-bold mb-4">Chats</h2>
      {dummyChats.map(chat => (
        <div
          key={chat.id}
          className="p-2 cursor-pointer hover:bg-gray-200 rounded"
          onClick={() => setSelectedChat(chat)}
        >
          {chat.name}
        </div>
      ))}
    </div>
  );
};

export default Sidebar;
