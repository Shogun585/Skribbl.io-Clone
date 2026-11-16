import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { LobbyView } from './components/LobbyView';
import { GameView } from './components/GameView';

const MainRouter: React.FC = () => {
  const { roomState, connected } = useSocket();
  const inActiveGame = Boolean(roomState && roomState.phase !== 'LOBBY');

  return (
    <div className="aurora-bg min-h-screen text-slate-100">
      <div className="aurora-blob-1" />
      <div className="aurora-blob-2" />

      {!connected && (
        <div className="relative z-40 bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs text-center py-1">
          Connecting to real-time WebSocket gateway...
        </div>
      )}

      {inActiveGame ? <GameView /> : <LobbyView />}
    </div>
  );
};

export function App() {
  return (
    <SocketProvider>
      <MainRouter />
    </SocketProvider>
  );
}

export default App;
