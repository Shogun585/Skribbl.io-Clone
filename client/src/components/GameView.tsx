import React, { useState } from 'react';
import { Crown, Eye, LogOut, Pencil, Send } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { Canvas } from './Canvas';
import { Modals } from './Modals';
import { ParticipantModal } from './ParticipantModal';
import { PlayerState } from '../types/shared';

export const GameView: React.FC = () => {
  const {
    myId,
    roomState,
    messages,
    mutedPlayerIds,
    sendChat,
    toggleSpectator,
    leaveRoom
  } = useSocket();

  const [chatText, setChatText] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<PlayerState | null>(null);

  if (!roomState) return null;

  const me = roomState.players.find((p) => p.id === myId);
  const visibleMessages = messages.filter((m) => !mutedPlayerIds.has(m.senderId));

  return (
    <div className="relative z-10 max-w-7xl mx-auto p-3 md:p-5 flex flex-col gap-4">
      {/* Top Game Status Bar */}
      <header className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-[#2CF08A]">
            #{roomState.roomId}
          </span>
          <span className="text-xs font-bold uppercase text-slate-300">
            Round {roomState.currentRound} / {roomState.maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-lg font-bold tracking-widest text-[#2CF08A]">
            {roomState.maskedWord || '_ _ _ _'}
            {roomState.wordLengths.length > 0 && (
              <span className="ml-2 text-xs text-slate-400">
                ({roomState.wordLengths.join('-')})
              </span>
            )}
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl font-mono font-bold text-sm border ${
              roomState.timeLeft <= 10
                ? 'bg-rose-600/30 border-rose-500 text-rose-200 animate-pulse'
                : 'bg-slate-800 border-slate-700 text-white'
            }`}
          >
            ⏱ {roomState.timeLeft}s
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleSpectator(!me?.isSpectator)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5 text-[#2CF08A]" />
            {me?.isSpectator ? 'Spectating' : 'Spectate'}
          </button>
          <button
            type="button"
            onClick={leaveRoom}
            className="px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-semibold flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>
      </header>

      {/* 3-Column Arena: scoreboard | canvas-area | chat-log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <aside className="scoreboard lg:col-span-3 rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Scoreboard (Click Player to Moderate)
          </h2>
          {roomState.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedParticipant(p)}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left ${
                p.hasGuessed
                  ? 'bg-emerald-950/60 border-[#2CF08A]'
                  : p.id === roomState.currentDrawerId
                  ? 'bg-sky-950/60 border-sky-400'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-xl">{p.avatar}</span>
                <div className="truncate">
                  <div className="font-bold text-xs text-white flex items-center gap-1 truncate">
                    <span>{p.name}</span>
                    {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                    {p.id === roomState.currentDrawerId && (
                      <Pencil className="w-3 h-3 text-sky-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {p.score} pts {p.roundScore > 0 ? `(+${p.roundScore})` : ''}
                  </div>
                </div>
              </div>
              {mutedPlayerIds.has(p.id) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900 text-rose-200">
                  Muted
                </span>
              )}
            </button>
          ))}
        </aside>

        <section className="canvas-area lg:col-span-6 relative">
          <Canvas />
          <Modals />
        </section>

        <aside className="chat-log lg:col-span-3 rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 flex flex-col h-[520px]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Chat &amp; Guess Stream
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {visibleMessages.map((m) => (
              <div
                key={m.id}
                className={`p-2 rounded-lg ${
                  m.type === 'correct_guess'
                    ? 'bg-emerald-950/90 border border-[#2CF08A] text-[#2CF08A] font-bold'
                    : m.type === 'close_guess'
                    ? 'bg-amber-950/90 border border-amber-400 text-amber-200 font-semibold'
                    : m.type === 'system'
                    ? 'bg-slate-800/70 text-slate-300 italic'
                    : 'bg-slate-950/80 text-slate-200'
                }`}
              >
                {m.type === 'chat' || m.type === 'spectator' ? (
                  <>
                    <span className="font-bold text-white">
                      {m.senderAvatar} {m.senderName}:{' '}
                    </span>
                    <span>{m.text}</span>
                  </>
                ) : (
                  <span>{m.text}</span>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatText.trim()) return;
              sendChat(chatText);
              setChatText('');
            }}
            className="mt-2.5 flex gap-1.5"
          >
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type your guess..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-[#2CF08A]"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-[#2CF08A] text-[#010413] font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      </div>

      <ParticipantModal
        player={selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
      />
    </div>
  );
};
