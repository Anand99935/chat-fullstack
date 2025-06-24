import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="h-screen flex items-center justify-center flex-col">
      <h1 className="text-3xl mb-4">Welcome to Chat App</h1>
      <Link to="/chat" className="text-blue-500 underline">Go to Chat</Link>
    </div>
  );
};

export default Home; 
