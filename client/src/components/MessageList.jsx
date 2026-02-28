import { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import MessageItem from './MessageItem';

export default function MessageList() {
  const { currentRoom, currentDM, messages, dmMessages } = useChat();
  const endRef = useRef(null);

  const currentMessages = currentRoom
    ? messages[currentRoom] || []
    : currentDM
    ? dmMessages[currentDM] || []
    : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  if (!currentRoom && !currentDM) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a room or conversation
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {currentMessages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
