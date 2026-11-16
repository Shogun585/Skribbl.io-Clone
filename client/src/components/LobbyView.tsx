import React, { useState } from 'react';
import { Copy, Crown, Eye, Play, Sparkles, Users } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { AvatarPicker } from './AvatarPicker';
import { LoadingScreen } from './LoadingScreen';
import { ParticipantModal } from './ParticipantModal';
import { PlayerState, SupportedLanguage, WordMode } from '../types/shared';

const PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
const LANGUAGE_OPTIONS: SupportedLanguage[] = ['English', 'Spanish', 'French', 'German', 'Hindi'];
const DRAWTIME_OPTIONS = [15, 30, 45, 60, 80, 100, 120, 150, 180, 240];
const ROUNDS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const WORD_MODES: { value: WordMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'combination', label: 'Combination' }
];
const WORD_COUNT_OPTIONS = [1, 2, 3, 4, 5];
const HINTS_OPTIONS = [0, 1, 2, 3, 4, 5];

export const LobbyView: React.FC = () => {
  const {
    isConnectingRoom,
    myId,
    playerName,
    avatar,
    isSpectatorPref,
    inviteRoomParam,
    roomState,
    publicRooms,
    errorBanner,
    setPlayerName,
    setAvatar,
    setIsSpectatorPref,
    createRoom,
    joinRoom,
    joinRandomRoom,
    leaveRoom,
    updateSettings,
    startGame,
    getInviteLink,
    clearError
  } = useSocket();

  const [manualCode, setManualCode] = useState(inviteRoomParam || '');
  const [customWordsText, setCustomWordsText] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<PlayerState | null>(null);

  const me = roomState?.players.find((p) => p.id === myId);
  const isHost = Boolean(me?.isHost);

  const handleCopyInvite = () => {
    const link = getInviteLink();
    navigator.clipboard?.writeText(link);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  if (isConnectingRoom) {
    return <LoadingScreen message="Get ready to doodle..." />;
  } 

  // Pre-Room Home Screen
  if (!roomState) {
    return (
      <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-6">
        <div className='flex items-center justify-center'>
              <h1 className="text-3xl font-bold text-white mt-2">Skribbl.io Clone</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-slate-800 p-6 shadow-2xl space-y-5">
            <div>
              <p className="text-xs text-slate-400 mt-1">
                Jump into a random public room or create a private room with custom rules.
              </p>
            </div>

            {errorBanner && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex justify-between">
                <span>{errorBanner}</span>
                <button type="button" onClick={clearError} className="font-bold underline">
                  Dismiss
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={playerName}
                maxLength={20}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-[#2CF08A]"
              />
              <button
                type="button"
                onClick={() => setIsSpectatorPref(!isSpectatorPref)}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  isSpectatorPref
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Eye className="w-4 h-4" />
                {isSpectatorPref ? 'Spectator' : 'Player'}
              </button>
            </div>

            <AvatarPicker selectedAvatar={avatar} onSelect={setAvatar} />

            {/* Primary Play! (Random Matchmaker) & Create Private Room */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={joinRandomRoom}
                className="w-full py-3.5 rounded-xl bg-[#2CF08A] hover:bg-emerald-400 text-[#010413] font-bold text-base shadow-lg shadow-[#2CF08A]/20 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> Play!
              </button>

              <button
                type="button"
                onClick={() => createRoom({ isPrivate: true })}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Create Private Room
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Invite Room code (e.g. XYZ123)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
              <button
                type="button"
                onClick={() => joinRoom(manualCode)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white"
              >
                Join via Code
              </button>
            </div>
          </div>

          {/* Public Rooms Directory */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-slate-800 p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2CF08A]" /> Active Public Rooms
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {publicRooms.length} Online
                </span>
              </div>
              {publicRooms.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
                  Click "Play!" on the left to automatically matchmake or provision a public room.
                </p>
              ) : (
                <div className="space-y-2">
                  {publicRooms.map((r) => (
                    <div
                      key={r.roomId}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#2CF08A]">#{r.roomId}</span>
                        <span className="ml-2 text-slate-300">Host: {r.hostName}</span>
                        <div className="text-slate-500 mt-0.5">
                          {r.playerCount}/{r.maxPlayers} players · {r.language}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => joinRoom(r.roomId)}
                        className="px-3 py-1.5 rounded-lg bg-[#2CF08A]/20 text-[#2CF08A] font-bold"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dropdown Room Config (ui.png Specifications) inside Room Lobby
  return (
    <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Dropdown Room Configuration */}
      <div className="lg:col-span-7 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-white">Room Settings</h2>
          <button
            type="button"
            onClick={leaveRoom}
            className="px-3 py-1 rounded-lg bg-rose-950/70 border border-rose-700 text-rose-200 text-xs font-semibold"
          >
            Leave Lobby
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Players</span>
            <select
              disabled={!isHost}
              value={roomState.settings.maxPlayers}
              onChange={(e) => updateSettings({ maxPlayers: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {PLAYERS_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Language</span>
            <select
              disabled={!isHost}
              value={roomState.settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as SupportedLanguage })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Drawtime</span>
            <select
              disabled={!isHost}
              value={roomState.settings.drawTime}
              onChange={(e) => updateSettings({ drawTime: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {DRAWTIME_OPTIONS.map((sec) => (
                <option key={sec} value={sec}>{sec}s</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Rounds</span>
            <select
              disabled={!isHost}
              value={roomState.settings.rounds}
              onChange={(e) => updateSettings({ rounds: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {ROUNDS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Game Mode</span>
            <select
              disabled={!isHost}
              value={roomState.settings.wordMode}
              onChange={(e) => updateSettings({ wordMode: e.target.value as WordMode })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {WORD_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">Word Count</span>
            <select
              disabled={!isHost}
              value={roomState.settings.wordCount}
              onChange={(e) => updateSettings({ wordCount: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {WORD_COUNT_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 sm:col-span-2">
            <span className="font-semibold text-slate-300">Hints</span>
            <select
              disabled={!isHost}
              value={roomState.settings.hints}
              onChange={(e) => updateSettings({ hints: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
            >
              {HINTS_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Custom Words + Exclusive Checkbox */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Custom Words</span>
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isHost}
                checked={roomState.settings.useCustomWordsOnly}
                onChange={(e) => updateSettings({ useCustomWordsOnly: e.target.checked })}
              />
              <span>Use custom words exclusively</span>
            </label>
          </div>
          <textarea
            rows={2}
            disabled={!isHost}
            value={customWordsText}
            onChange={(e) => {
              setCustomWordsText(e.target.value);
              updateSettings({
                customWords: e.target.value.split(',').map((w) => w.trim()).filter(Boolean)
              });
            }}
            placeholder="Minimum of 10 words. 1-32 characters per word! Separated by a , (comma)"
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
        </div>

        {/* Start Game + Hoverable Invite Link Box */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          <button
            type="button"
            disabled={!isHost}
            onClick={startGame}
            className="sm:col-span-7 py-3 rounded-xl bg-[#2CF08A] hover:bg-emerald-400 disabled:opacity-40 text-[#010413] font-bold text-sm"
          >
            Start!
          </button>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="sm:col-span-5 group relative py-3 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-300 overflow-hidden flex items-center justify-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-[#2CF08A]" />
            <span className="group-hover:hidden">
              {copiedInvite ? 'Copied Link!' : 'Hover / Click to Invite'}
            </span>
            <span className="hidden group-hover:inline truncate text-[#2CF08A]">
              {getInviteLink()}
            </span>
          </button>
        </div>
      </div>

      {/* Right: Joined Players Roster (Click player to open ParticipantModal) */}
      <div className="lg:col-span-5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 shadow-2xl space-y-4">
        <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">
          Players in Lobby ({roomState.players.length}/{roomState.settings.maxPlayers})
        </h3>
        <p className="text-xs text-slate-500">
          Click any participant card to open moderation options (Kick, Ban, Votekick, Mute, Report).
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {roomState.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedParticipant(p)}
              className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 flex items-center gap-2.5 text-left"
            >
              <span className="text-2xl">{p.avatar}</span>
              <div className="truncate">
                <div className="font-bold text-xs text-white flex items-center gap-1 truncate">
                  <span>{p.name}</span>
                  {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </div>
                <span className="text-[10px] text-slate-400">
                  {p.isSpectator ? 'Spectator' : 'Ready'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <ParticipantModal
        player={selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
      />
    </div>
  );
};
