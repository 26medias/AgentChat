import { useChat } from '../context/ChatContext';

export default function RoomList() {
  const { rooms, joinedRooms, currentRoom, joinRoom, setCurrentRoom } = useChat();

  const handleClick = (room) => {
    if (!joinedRooms.includes(room.name)) {
      joinRoom(room.name);
    }
    setCurrentRoom(room.name);
  };

  return (
    <div className="space-y-0.5">
      {rooms.map((room) => {
        const isJoined = joinedRooms.includes(room.name);
        const isActive = currentRoom === room.name;
        return (
          <button
            key={room.name}
            onClick={() => handleClick(room)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm truncate transition ${
              isActive
                ? 'bg-gray-600 text-white'
                : isJoined
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-500 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            <span className="mr-1">#</span>
            {room.name}
            {!isJoined && <span className="text-xs text-gray-600 ml-1">(join)</span>}
          </button>
        );
      })}
      {rooms.length === 0 && (
        <p className="text-gray-500 text-xs px-2">No rooms yet</p>
      )}
    </div>
  );
}
