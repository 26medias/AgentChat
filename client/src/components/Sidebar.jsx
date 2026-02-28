import { useState } from 'react';
import { useChat } from '../context/ChatContext';
import RoomList from './RoomList';
import DMList from './DMList';
import CreateRoomModal from './CreateRoomModal';

export default function Sidebar() {
  const { user, logout } = useChat();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="w-64 bg-gray-800 flex flex-col border-r border-gray-700 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold">AgentChat</h2>
        <p className="text-sm text-gray-400 truncate">{user?.username}</p>
      </div>

      {/* Rooms */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase">Rooms</span>
            <button
              onClick={() => setShowCreate(true)}
              className="text-gray-400 hover:text-white text-lg leading-none"
              title="Create room"
            >
              +
            </button>
          </div>
          <RoomList />
        </div>

        <div className="p-3 border-t border-gray-700">
          <span className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
            Direct Messages
          </span>
          <DMList />
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white"
        >
          Logout
        </button>
      </div>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
