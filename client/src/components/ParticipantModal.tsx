import React, { useState } from 'react';
import { Ban, Flag, ShieldAlert, UserX, Volume2, VolumeX, X } from 'lucide-react';
import { PlayerState } from '../types/shared';
import { useSocket } from '../context/SocketContext';

interface ParticipantModalProps {
  player: PlayerState | null;
  onClose: () => void;
}

export const ParticipantModal: React.FC<ParticipantModalProps> = ({ player, onClose }) => {
  const {
    myId,
    roomState,
    mutedPlayerIds,
    kickPlayer,
    banPlayer,
    voteKickPlayer,
    toggleMutePlayer,
    reportPlayer
  } = useSocket();

  const [reportSubmitted, setReportSubmitted] = useState(false);

  if (!player) return null;

  const me = roomState?.players.find((p) => p.id === myId);
  const amIHost = Boolean(me?.isHost);
  const isMuted = mutedPlayerIds.has(player.id);
  const isSelf = player.id === myId;

  const handleKick = () => {
    kickPlayer(player.id);
    onClose();
  };

  const handleBan = () => {
    banPlayer(player.id);
    onClose();
  };

  const handleVotekick = () => {
    voteKickPlayer(player.id);
    onClose();
  };

  const handleMute = () => {
    toggleMutePlayer(player.id);
  };

  const handleReport = () => {
    reportPlayer(player.id, 'Reported via Participant Modal');
    setReportSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{player.avatar}</span>
            <div>
              <h3 className="font-bold text-white text-base">{player.name}</h3>
              <span className="text-xs text-slate-400">
                {player.score} pts · {player.isHost ? 'Room Host' : player.isSpectator ? 'Spectator' : 'Player'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSelf ? (
          <p className="text-xs text-slate-400 text-center py-2">
            This is your active profile.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 text-xs font-semibold">
            {amIHost && (
              <>
                <button
                  type="button"
                  onClick={handleKick}
                  className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 flex items-center justify-center gap-1.5"
                >
                  <UserX className="w-4 h-4" /> Kick
                </button>
                <button
                  type="button"
                  onClick={handleBan}
                  className="py-2.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-4 h-4" /> Ban
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleVotekick}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Votekick ({player.votekickCount})
            </button>

            <button
              type="button"
              onClick={handleMute}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5"
            >
              {isMuted ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#2CF08A]" /> Unmute
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" /> Mute
                </>
              )}
            </button>

            <button
              type="button"
              disabled={reportSubmitted}
              onClick={handleReport}
              className="col-span-2 py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-700/50 text-rose-200 flex items-center justify-center gap-1.5"
            >
              <Flag className="w-4 h-4" />
              {reportSubmitted ? 'Report Submitted ✓' : 'Report Player'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
