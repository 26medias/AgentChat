import { useChat } from '../context/ChatContext';

export default function DMList() {
  const { dmConversations, currentDM, setCurrentDM } = useChat();

  return (
    <div className="space-y-0.5">
      {dmConversations.map((username) => (
        <button
          key={username}
          onClick={() => setCurrentDM(username)}
          className={`w-full text-left px-2 py-1.5 rounded text-sm truncate transition ${
            currentDM === username
              ? 'bg-gray-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          {username}
        </button>
      ))}
      {dmConversations.length === 0 && (
        <p className="text-gray-500 text-xs px-2">No conversations</p>
      )}
    </div>
  );
}
