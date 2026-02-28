import { useChat } from '../context/ChatContext';

export default function RoomHeader() {
  const { currentRoom, currentDM, rooms, onlineUsers, leaveRoom } = useChat();

  if (currentDM) {
    return (
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
        <h3 className="font-semibold">DM with {currentDM}</h3>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
        <h3 className="text-gray-400">Select a room to start chatting</h3>
      </div>
    );
  }

  const room = rooms.find(r => r.name === currentRoom);
  const userCount = onlineUsers[currentRoom]?.length || 0;

  return (
    <div className="px-4 py-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
      <div>
        <h3 className="font-semibold">
          <span className="text-gray-400 mr-1">#</span>
          {currentRoom}
        </h3>
        {room?.description && (
          <p className="text-sm text-gray-400">{room.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">{userCount} online</span>
        <button
          onClick={() => leaveRoom(currentRoom)}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
