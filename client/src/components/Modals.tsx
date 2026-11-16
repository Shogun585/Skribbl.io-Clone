import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export const Modals: React.FC = () => {
  const {
    myId,
    roomState,
    wordOptions,
    roundEndData,
    gameOverData,
    selectWord,
    startGame
  } = useSocket();

  useEffect(() => {
    if (roomState?.phase === 'GAME_OVER') {
      try {
        confetti({ particleCount: 120, spread: 80 });
      } catch {
        // Ignore in headless environments
      }
    }
  }, [roomState?.phase]);

  if (!roomState) return null;

  const isDrawer = roomState.currentDrawerId === myId;
  const me = roomState.players.find((p) => p.id === myId);

  if (roomState.phase === 'WORD_SELECT') {
    return (
      <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center">
        {isDrawer && wordOptions.length > 0 ? (
          <div className="space-y-4">
            <span className="text-xs font-mono text-[#2CF08A] uppercase">
              Choose Within {roomState.timeLeft}s
            </span>
            <h3 className="text-2xl font-bold text-white">Select a Word to Draw</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {wordOptions.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => selectWord(w)}
                  className="px-5 py-2.5 rounded-xl bg-[#2CF08A] hover:bg-emerald-400 text-[#010413] font-mono font-bold uppercase text-sm"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">
              {roomState.currentDrawerName || 'Drawer'} is choosing a word...
            </h3>
            <span className="text-xs font-mono text-slate-400">{roomState.timeLeft}s remaining</span>
          </div>
        )}
      </div>
    );
  }

  if (roomState.phase === 'ROUND_END' && roundEndData) {
    return (
      <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-3">
        <span className="text-xs font-mono uppercase text-amber-300">{roundEndData.reason}</span>
        <h3 className="text-2xl font-bold text-white">
          The word was:{' '}
          <span className="text-[#2CF08A] font-mono uppercase">{roundEndData.word}</span>
        </h3>
        <div className="w-full max-w-xs bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
          {roundEndData.scores.map((p) => (
            <div key={p.id} className="flex justify-between text-slate-200">
              <span>
                {p.avatar} {p.name}
              </span>
              <span className="font-mono text-[#2CF08A]">+{p.roundScore} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (roomState.phase === 'GAME_OVER' && gameOverData) {
    return (
      <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Crown className="w-12 h-12 text-amber-400" />
        <h3 className="text-3xl font-bold text-white">
          Winner: {gameOverData.winner?.avatar} {gameOverData.winner?.name || 'Tie'}!
        </h3>
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5 text-xs">
          {gameOverData.podium.map((p, idx) => (
            <div key={p.id} className="flex justify-between font-semibold text-slate-200">
              <span>
                #{idx + 1} {p.avatar} {p.name}
              </span>
              <span className="font-mono text-[#2CF08A]">{p.score} pts</span>
            </div>
          ))}
        </div>
        {me?.isHost && (
          <button
            type="button"
            onClick={startGame}
            className="px-6 py-2.5 rounded-xl bg-[#2CF08A] text-[#010413] font-bold text-sm"
          >
            Play Again
          </button>
        )}
      </div>
    );
  }

  return null;
};
