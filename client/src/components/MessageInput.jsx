import { useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';

export default function MessageInput() {
  const [text, setText] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const { currentRoom, currentDM, sendMessage, sendDM, sendCommand, commands } = useChat();
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    // Check for command
    if (currentRoom && trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      const cmd = parts[0];
      const args = parts.slice(1).join(' ');
      sendCommand(currentRoom, cmd, args);
    } else if (currentDM) {
      sendDM(currentDM, trimmed);
    } else if (currentRoom) {
      sendMessage(currentRoom, trimmed);
    }

    setText('');
    setShowCommands(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    setShowCommands(val.startsWith('/') && currentRoom);
  };

  const handleCommandClick = (cmd) => {
    setText(`/${cmd.name} `);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const filteredCommands = commands.filter(c =>
    text.length > 1 ? c.name.startsWith(text.slice(1).split(' ')[0]) : true
  );

  const placeholder = currentDM
    ? `Message @${currentDM}`
    : `Message #${currentRoom}`;

  return (
    <div className="relative px-4 pb-4">
      {showCommands && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.name}
              onClick={() => handleCommandClick(cmd)}
              className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm"
            >
              <span className="text-blue-400">/{cmd.name}</span>
              <span className="text-gray-400 ml-2">{cmd.description}</span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </form>
    </div>
  );
}
