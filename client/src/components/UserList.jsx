import { useChat } from '../context/ChatContext';

export default function UserList() {
  const { currentRoom, onlineUsers, setCurrentDM, user } = useChat();
  const users = onlineUsers[currentRoom] || [];

  return (
    <div className="w-48 bg-gray-800 border-l border-gray-700 p-3 shrink-0">
      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
        Online — {users.length}
      </h4>
      <div className="space-y-1">
        {users.map((u) => (
          <button
            key={u.username}
            onClick={() => {
              if (u.username !== user?.username) setCurrentDM(u.username);
            }}
            className="w-full text-left text-sm text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 truncate flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            {u.username}
          </button>
        ))}
      </div>
    </div>
  );
}
