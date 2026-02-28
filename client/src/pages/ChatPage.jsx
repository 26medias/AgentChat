import { useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import Sidebar from '../components/Sidebar';
import RoomHeader from '../components/RoomHeader';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import UserList from '../components/UserList';

export default function ChatPage() {
  const { listRooms, loadDMList, listCommands, currentRoom, currentDM } = useChat();

  useEffect(() => {
    listRooms();
    loadDMList();
    listCommands();
  }, [listRooms, loadDMList, listCommands]);

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <RoomHeader />
        <MessageList />
        {(currentRoom || currentDM) && <MessageInput />}
      </div>

      {/* User list - only show for rooms */}
      {currentRoom && <UserList />}
    </div>
  );
}
