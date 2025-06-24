import React from "react";
import classNames from "classnames";

const MessageBubble = ({ message, isOwn }) => {
  return (
    <div
      className={classNames(
        "flex px-4 py-1",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={classNames(
          "relative px-4 py-2 text-sm rounded-2xl max-w-[80%] shadow",
          isOwn
            ? "bg-[#DCF8C6] text-black rounded-br-none"
            : "bg-white text-black rounded-bl-none"
        )}
      >
        {message}
        <div className="text-[10px] text-gray-500 text-right mt-1">Hello I am here to help you ! but How ?</div>
      </div>
    </div>
  );
};

export default MessageBubble;
