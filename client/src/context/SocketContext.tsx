import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ChatMessage,
  ClientToServerEvents,
  DrawMovePayload,
  DrawStartPayload,
  GameOverPayload,
  RoomSettings,
  RoomState,
  RoomSummary,
  RoundEndPayload,
  ServerToClientEvents
} from '../types/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

interface SocketContextValue {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  connected: boolean;
  isConnectingRoom: boolean;
  myId: string | null;
  playerName: string;
  avatar: string;
  isSpectatorPref: boolean;
  inviteRoomParam: string | null;
  roomState: RoomState | null;
  publicRooms: RoomSummary[];
  wordOptions: string[];
  messages: ChatMessage[];
  roundEndData: RoundEndPayload | null;
  gameOverData: GameOverPayload | null;
  mutedPlayerIds: Set<string>;
  errorBanner: string | null;

  setPlayerName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setIsSpectatorPref: (val: boolean) => void;
  createRoom: (settings?: Partial<RoomSettings>) => void;
  joinRoom: (roomId: string) => void;
  joinRandomRoom: () => void;
  leaveRoom: () => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  toggleSpectator: (isSpectator: boolean) => void;
  startGame: () => void;
  selectWord: (word: string) => void;
  emitDrawStart: (payload: DrawStartPayload) => void;
  emitDrawMove: (payload: DrawMovePayload) => void;
  emitDrawEnd: () => void;
  emitDrawFill: (payload: DrawStartPayload) => void;
  emitUndo: () => void;
  emitClear: () => void;
  sendChat: (text: string) => void;
  kickPlayer: (targetId: string) => void;
  banPlayer: (targetId: string) => void;
  voteKickPlayer: (targetId: string) => void;
  toggleMutePlayer: (targetId: string) => void;
  reportPlayer: (targetId: string, reason: string) => void;
  getInviteLink: () => string;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [isConnectingRoom, setIsConnectingRoom] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  const [playerName, setPlayerNameState] = useState<string>(() => {
    try {
      return localStorage.getItem('skribbl_name') || 'Abhilash';
    } catch {
      return 'Abhilash';
    }
  });

  const [avatar, setAvatarState] = useState<string>(() => {
    try {
      return localStorage.getItem('skribbl_avatar') || '🦊';
    } catch {
      return '🦊';
    }
  });

  const [isSpectatorPref, setIsSpectatorPref] = useState(false);
  const [inviteRoomParam, setInviteRoomParam] = useState<string | null>(null);

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roundEndData, setRoundEndData] = useState<RoundEndPayload | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverPayload | null>(null);
  const [mutedPlayerIds, setMutedPlayerIds] = useState<Set<string>>(new Set());
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    // Direct Link Invites (?room=XYZ URL Routing)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setInviteRoomParam(roomParam.trim().toUpperCase());
    }

    const s: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      setConnected(true);
      setMyId(s.id ?? null);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('room:state', (st) => {
      setIsConnectingRoom(false);
      setRoomState(st);
      if (st.phase !== 'WORD_SELECT') setWordOptions([]);
      if (st.phase !== 'ROUND_END') setRoundEndData(null);
      if (st.phase !== 'GAME_OVER') setGameOverData(null);
    });

    s.on('room:public_list', (rooms) => {
      setPublicRooms(rooms);
    });

    s.on('room:error', ({ message }) => {
      setIsConnectingRoom(false);
      setErrorBanner(message);
    });

    s.on('room:kicked', ({ reason }) => {
      setIsConnectingRoom(false);
      setRoomState(null);
      setMessages([]);
      setErrorBanner(reason);
    });

    s.on('game:word_options', ({ words }) => {
      setWordOptions(words);
    });

    s.on('game:tick', ({ timeLeft }) => {
      setRoomState((prev) => (prev ? { ...prev, timeLeft } : prev));
    });

    s.on('game:hint_revealed', ({ maskedWord, hintsRevealed }) => {
      setRoomState((prev) =>
        prev ? { ...prev, maskedWord, hintsRevealed } : prev
      );
    });

    s.on('game:round_end', (payload) => {
      setRoundEndData(payload);
    });

    s.on('game:over', (payload) => {
      setGameOverData(payload);
    });

    s.on('chat:message', (msg) => {
      setMessages((prev) => [...prev.slice(-120), msg]);
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const setPlayerName = (name: string) => {
    setPlayerNameState(name);
    try {
      localStorage.setItem('skribbl_name', name);
    } catch {
      // Ignore storage restriction
    }
  };

  const setAvatar = (newAvatar: string) => {
    setAvatarState(newAvatar);
    try {
      localStorage.setItem('skribbl_avatar', newAvatar);
    } catch {
      // Ignore storage restriction
    }
  };

  const createRoom = (settings?: Partial<RoomSettings>) => {
    if (!socket) return;
    setIsConnectingRoom(true);
    socket.emit('room:create', {
      playerName,
      avatar,
      isSpectator: isSpectatorPref,
      settings
    });
  };

  const joinRoom = (roomId: string) => {
    if (!socket || !roomId.trim()) return;
    setIsConnectingRoom(true);
    socket.emit('room:join', {
      roomId: roomId.trim().toUpperCase(),
      playerName,
      avatar,
      isSpectator: isSpectatorPref
    });
  };

  const joinRandomRoom = () => {
    if (!socket) return;
    setIsConnectingRoom(true);
    socket.emit('room:join_random', {
      playerName,
      avatar,
      isSpectator: isSpectatorPref
    });
  };

  const leaveRoom = () => {
    socket?.emit('room:leave');
    setRoomState(null);
    setMessages([]);
    setWordOptions([]);
  };

  const updateSettings = (settings: Partial<RoomSettings>) => {
    socket?.emit('room:settings', settings);
  };

  const toggleSpectator = (isSpectator: boolean) => {
    socket?.emit('room:toggle_spectator', { isSpectator });
  };

  const startGame = () => {
    socket?.emit('game:start');
  };

  const selectWord = (word: string) => {
    socket?.emit('game:select_word', { word });
  };

  const emitDrawStart = (payload: DrawStartPayload) => {
    socket?.emit('draw:start', payload);
  };

  const emitDrawMove = (payload: DrawMovePayload) => {
    socket?.emit('draw:move', payload);
  };

  const emitDrawEnd = () => {
    socket?.emit('draw:end');
  };

  const emitDrawFill = (payload: DrawStartPayload) => {
    socket?.emit('draw:fill', payload);
  };

  const emitUndo = () => {
    socket?.emit('draw:undo');
  };

  const emitClear = () => {
    socket?.emit('draw:clear');
  };

  const sendChat = (text: string) => {
    socket?.emit('chat:send', { text });
  };

  const kickPlayer = (targetId: string) => {
    socket?.emit('room:kick', { targetId });
  };

  const banPlayer = (targetId: string) => {
    socket?.emit('room:ban', { targetId });
  };

  const voteKickPlayer = (targetId: string) => {
    socket?.emit('room:votekick', { targetId });
  };

  const toggleMutePlayer = (targetId: string) => {
    setMutedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  };

  const reportPlayer = (targetId: string, reason: string) => {
    socket?.emit('room:report', { targetId, reason });
  };

  const getInviteLink = () => {
    const code = roomState?.roomId || inviteRoomParam || '';
    return `${window.location.origin}/?room=${code}`;
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        isConnectingRoom,
        myId,
        playerName,
        avatar,
        isSpectatorPref,
        inviteRoomParam,
        roomState,
        publicRooms,
        wordOptions,
        messages,
        roundEndData,
        gameOverData,
        mutedPlayerIds,
        errorBanner,
        setPlayerName,
        setAvatar,
        setIsSpectatorPref,
        createRoom,
        joinRoom,
        joinRandomRoom,
        leaveRoom,
        updateSettings,
        toggleSpectator,
        startGame,
        selectWord,
        emitDrawStart,
        emitDrawMove,
        emitDrawEnd,
        emitDrawFill,
        emitUndo,
        emitClear,
        sendChat,
        kickPlayer,
        banPlayer,
        voteKickPlayer,
        toggleMutePlayer,
        reportPlayer,
        getInviteLink,
        clearError: () => setErrorBanner(null)
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
