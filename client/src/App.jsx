import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider, useChat } from './context/ChatContext';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }) {
  const { user } = useChat();
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <ChatProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </ChatProvider>
  );
}
