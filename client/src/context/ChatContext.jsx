import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import useWebSocket from '../hooks/useWebSocket';

const ChatContext = createContext();

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

const initialState = {
  user: null,
  token: localStorage.getItem('agentchat_token'),
  rooms: [],
  joinedRooms: [],
  currentRoom: null,
  currentDM: null,
  messages: {},
  dmConversations: [],
  dmMessages: {},
  onlineUsers: {},
  commands: [],
  authError: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return { ...state, user: action.user, token: action.token, authError: null };
    case 'AUTH_ERROR':
      return { ...state, authError: action.message };
    case 'LOGOUT':
      return { ...initialState, token: null };
    case 'SET_ROOMS':
      return { ...state, rooms: action.rooms };
    case 'ROOM_CREATED':
      return { ...state, rooms: [...state.rooms, action.room] };
    case 'ROOM_JOINED': {
      const joined = state.joinedRooms.includes(action.room)
        ? state.joinedRooms
        : [...state.joinedRooms, action.room];
      return { ...state, joinedRooms: joined };
    }
    case 'ROOM_LEFT':
      return {
        ...state,
        joinedRooms: state.joinedRooms.filter(r => r !== action.room),
        currentRoom: state.currentRoom === action.room ? null : state.currentRoom,
      };
    case 'SET_CURRENT_ROOM':
      return { ...state, currentRoom: action.room, currentDM: null };
    case 'SET_CURRENT_DM':
      return { ...state, currentDM: action.username, currentRoom: null };
    case 'ROOM_HISTORY': {
      const msgs = { ...state.messages, [action.room]: action.messages };
      return { ...state, messages: msgs };
    }
    case 'NEW_MESSAGE': {
      const room = action.message.room;
      const existing = state.messages[room] || [];
      return { ...state, messages: { ...state.messages, [room]: [...existing, action.message] } };
    }
    case 'ROOM_USERS':
      return { ...state, onlineUsers: { ...state.onlineUsers, [action.room]: action.users } };
    case 'USER_JOINED_ROOM': {
      const users = state.onlineUsers[action.room] || [];
      if (users.find(u => u.username === action.user)) return state;
      return {
        ...state,
        onlineUsers: {
          ...state.onlineUsers,
          [action.room]: [...users, { username: action.user, online: true }],
        },
      };
    }
    case 'USER_LEFT_ROOM': {
      const users = (state.onlineUsers[action.room] || []).filter(u => u.username !== action.user);
      return { ...state, onlineUsers: { ...state.onlineUsers, [action.room]: users } };
    }
    case 'DM_LIST':
      return { ...state, dmConversations: action.conversations };
    case 'DM_HISTORY':
      return { ...state, dmMessages: { ...state.dmMessages, [action.with]: action.messages } };
    case 'NEW_DM': {
      const other = action.message.from === state.user?.username ? action.message.to : action.message.from;
      const existing = state.dmMessages[other] || [];
      const convos = state.dmConversations.includes(other)
        ? state.dmConversations
        : [...state.dmConversations, other];
      return {
        ...state,
        dmMessages: { ...state.dmMessages, [other]: [...existing, action.message] },
        dmConversations: convos,
      };
    }
    case 'SET_COMMANDS':
      return { ...state, commands: action.commands };
    case 'PROFILE_UPDATED':
      return { ...state, user: action.user };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Message handler called directly from WebSocket onmessage (no React state batching)
  const onMessageRef = useRef(null);
  onMessageRef.current = (msg) => {
    switch (msg.type) {
      case 'auth:success':
        localStorage.setItem('agentchat_token', msg.token);
        dispatch({ type: 'AUTH_SUCCESS', user: msg.user, token: msg.token });
        break;
      case 'auth:error':
        dispatch({ type: 'AUTH_ERROR', message: msg.message });
        break;
      case 'auth:profile_updated':
        dispatch({ type: 'PROFILE_UPDATED', user: msg.user });
        break;
      case 'room:list':
        dispatch({ type: 'SET_ROOMS', rooms: msg.rooms });
        break;
      case 'room:created':
        dispatch({ type: 'ROOM_CREATED', room: msg.room });
        break;
      case 'room:joined':
        if (msg.user === stateRef.current.user?.username) {
          dispatch({ type: 'ROOM_JOINED', room: msg.room });
        }
        dispatch({ type: 'USER_JOINED_ROOM', room: msg.room, user: msg.user });
        break;
      case 'room:left':
        if (msg.user === stateRef.current.user?.username) {
          dispatch({ type: 'ROOM_LEFT', room: msg.room });
        }
        dispatch({ type: 'USER_LEFT_ROOM', room: msg.room, user: msg.user });
        break;
      case 'room:history':
        dispatch({ type: 'ROOM_HISTORY', room: msg.room, messages: msg.messages });
        break;
      case 'room:users':
        dispatch({ type: 'ROOM_USERS', room: msg.room, users: msg.users });
        break;
      case 'message:new':
        dispatch({ type: 'NEW_MESSAGE', message: msg });
        break;
      case 'dm:new':
        dispatch({ type: 'NEW_DM', message: msg });
        break;
      case 'dm:list':
        dispatch({ type: 'DM_LIST', conversations: msg.conversations });
        break;
      case 'dm:history':
        dispatch({ type: 'DM_HISTORY', with: msg.with, messages: msg.messages });
        break;
      case 'command:result':
        dispatch({
          type: 'NEW_MESSAGE',
          message: {
            id: `cmd-${Date.now()}`,
            room: msg.room,
            from: null,
            message: msg.result,
            timestamp: Date.now(),
            metadata: { system: true, command: msg.command },
          },
        });
        break;
      case 'command:error':
        dispatch({
          type: 'NEW_MESSAGE',
          message: {
            id: `cmd-err-${Date.now()}`,
            room: msg.room || stateRef.current.currentRoom,
            from: null,
            message: msg.message,
            timestamp: Date.now(),
            metadata: { system: true, error: true },
          },
        });
        break;
      case 'command:list':
        dispatch({ type: 'SET_COMMANDS', commands: msg.commands });
        break;
      case 'presence:online':
        dispatch({ type: 'USER_JOINED_ROOM', room: msg.room, user: msg.username });
        break;
      case 'presence:offline':
        dispatch({ type: 'USER_LEFT_ROOM', room: msg.room, user: msg.username });
        break;
    }
  };

  const { connect, connected, send, disconnect } = useWebSocket(WS_URL, onMessageRef);

  // Actions
  const login = useCallback((username, password) => {
    connect();
    const check = setInterval(() => {
      send({ type: 'auth:login', username, password });
      clearInterval(check);
    }, 100);
  }, [connect, send]);

  const register = useCallback((username, password) => {
    connect();
    const check = setInterval(() => {
      send({ type: 'auth:register', username, password });
      clearInterval(check);
    }, 100);
  }, [connect, send]);

  const logout = useCallback(() => {
    localStorage.removeItem('agentchat_token');
    disconnect();
    dispatch({ type: 'LOGOUT' });
  }, [disconnect]);

  const listRooms = useCallback(() => send({ type: 'room:list' }), [send]);
  const createRoom = useCallback((name, description, metadata) => {
    send({ type: 'room:create', name, description, metadata });
  }, [send]);

  const joinRoom = useCallback((room) => {
    send({ type: 'room:join', room });
  }, [send]);

  const leaveRoom = useCallback((room) => {
    send({ type: 'room:leave', room });
  }, [send]);

  const setCurrentRoom = useCallback((room) => {
    dispatch({ type: 'SET_CURRENT_ROOM', room });
    send({ type: 'room:history', room });
    send({ type: 'room:users', room });
  }, [send]);

  const setCurrentDM = useCallback((username) => {
    dispatch({ type: 'SET_CURRENT_DM', username });
    send({ type: 'dm:history', with: username });
  }, [send]);

  const sendMessage = useCallback((room, message, metadata) => {
    send({ type: 'message:send', room, message, metadata });
  }, [send]);

  const sendDM = useCallback((to, message, metadata) => {
    send({ type: 'dm:send', to, message, metadata });
  }, [send]);

  const sendCommand = useCallback((room, command, args) => {
    send({ type: 'command:send', room, command, args });
  }, [send]);

  const listCommands = useCallback(() => send({ type: 'command:list' }), [send]);

  const loadDMList = useCallback(() => send({ type: 'dm:list' }), [send]);

  const updateProfile = useCallback((avatar, about) => {
    send({ type: 'auth:update_profile', avatar, about });
  }, [send]);

  // Auto-resume on mount if we have a token
  useEffect(() => {
    if (state.token && !state.user) {
      connect();
      const check = setInterval(() => {
        send({ type: 'auth:resume', token: state.token });
        clearInterval(check);
      }, 100);
    }
  }, []);

  const value = {
    ...state,
    connected,
    login,
    register,
    logout,
    listRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    setCurrentDM,
    sendMessage,
    sendDM,
    sendCommand,
    listCommands,
    loadDMList,
    updateProfile,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}
