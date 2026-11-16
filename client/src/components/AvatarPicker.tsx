import React from 'react';
import { Dices } from 'lucide-react';

export const AVATAR_LIST: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁',
  '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇',
  '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
  '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🦒',
  '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌'
];

interface AvatarPickerProps {
  selectedAvatar: string;
  onSelect: (avatar: string) => void;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedAvatar, onSelect }) => {
  const randomize = () => {
    const next = AVATAR_LIST[Math.floor(Math.random() * AVATAR_LIST.length)];
    onSelect(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Avatar ({AVATAR_LIST.length} Emojis)
        </span>
        <button
          type="button"
          onClick={randomize}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-[#2CF08A] flex items-center gap-1"
        >
          <Dices className="w-3.5 h-3.5" /> Randomize
        </button>
      </div>

      <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950/80 border border-slate-800">
        {AVATAR_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-transform ${
              selectedAvatar === emoji
                ? 'bg-[#2CF08A]/20 border-2 border-[#2CF08A] scale-110'
                : 'hover:bg-slate-800 border border-transparent'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
