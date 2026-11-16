export type WordMode = 'normal' | 'hidden' | 'combination';
export type WordCategory = 'all' | 'animals' | 'food' | 'objects' | 'space' | 'actions' | 'tech';
export type SupportedLanguage = 'English' | 'Spanish' | 'French' | 'German' | 'Hindi';
export type GamePhase = 'LOBBY' | 'WORD_SELECT' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER';
export type DrawingTool = 'brush' | 'eraser' | 'fill';

export interface RoomSettings {
  maxPlayers: number;           // 2-20 (dropdown_room_config)
  language: SupportedLanguage;  // Language selector
  drawTime: number;             // 15-240 seconds
  rounds: number;               // 2-10 rounds
  wordMode: WordMode;           // Normal, Hidden, Combination
  wordCount: number;            // 1-5 word choices
  hints: number;                // 0-5 progressive hints
  category: WordCategory;       // Category filter
  isPrivate: boolean;           // Public vs Private room
  customWords: string[];        // Custom word list
  useCustomWordsOnly: boolean;  // Exclusive custom words toggle
}

export interface Point {
  x: number; // Normalized 0.0 - 1.0 (coord_normalizer)
  y: number; // Normalized 0.0 - 1.0
}

export interface DrawStartPayload {
  strokeId?: string;
  x: number;
  y: number;
  color: string;
  size: number;
  tool: DrawingTool;
}

export interface DrawMovePayload {
  strokeId?: string;
  x: number;
  y: number;
}

export interface StrokeRecord {
  id: string;
  tool: DrawingTool;
  color: string;
  size: number;
  points: Point[];
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: string;
  score: number;
  roundScore: number;
  isHost: boolean;
  isSpectator: boolean;
  hasGuessed: boolean;
  votekickCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: 'chat' | 'correct_guess' | 'close_guess' | 'system' | 'spectator';
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  settings: RoomSettings;
  phase: GamePhase;
  currentRound: number;
  maxRounds: number;
  currentDrawerId: string | null;
  currentDrawerName: string | null;
  maskedWord: string;
  wordLengths: number[];
  hintsRevealed: number;
  timeLeft: number;
  phaseEndTime: number | null;
  players: PlayerState[];
  strokes: StrokeRecord[];
}

export interface RoomSummary {
  roomId: string;
  hostName: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  phase: GamePhase;
  currentRound: number;
  maxRounds: number;
  language: SupportedLanguage;
  category: WordCategory;
}

export interface RoundEndPayload {
  word: string;
  reason: string;
  scores: PlayerState[];
  nextDrawerId: string | null;
}

export interface GameOverPayload {
  winner: PlayerState | null;
  podium: PlayerState[];
}

export interface ClientToServerEvents {
  'room:create': (payload: {
    playerName: string;
    avatar: string;
    isSpectator?: boolean;
    settings?: Partial<RoomSettings>;
  }) => void;
  'room:join': (payload: {
    roomId: string;
    playerName: string;
    avatar: string;
    isSpectator?: boolean;
  }) => void;
  'room:join_random': (payload: {
    playerName: string;
    avatar: string;
    isSpectator?: boolean;
  }) => void;
  'room:leave': () => void;
  'room:settings': (settings: Partial<RoomSettings>) => void;
  'room:toggle_spectator': (payload: { isSpectator: boolean }) => void;
  'room:kick': (payload: { targetId: string }) => void;
  'room:ban': (payload: { targetId: string }) => void;
  'room:votekick': (payload: { targetId: string }) => void;
  'room:report': (payload: { targetId: string; reason: string }) => void;

  'game:start': () => void;
  'game:select_word': (payload: { word: string }) => void;

  'draw:start': (payload: DrawStartPayload) => void;
  'draw:move': (payload: DrawMovePayload) => void;
  'draw:end': () => void;
  'draw:fill': (payload: DrawStartPayload) => void;
  'draw:undo': () => void;
  'draw:clear': () => void;

  'chat:send': (payload: { text: string }) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:public_list': (rooms: RoomSummary[]) => void;
  'room:error': (payload: { message: string }) => void;
  'room:kicked': (payload: { reason: string; banned: boolean }) => void;

  'game:word_options': (payload: { words: string[]; timeLeft: number }) => void;
  'game:turn_started': (payload: {
    drawerId: string;
    drawerName: string;
    drawTime: number;
    maskedWord: string;
    wordLengths: number[];
  }) => void;
  'game:tick': (payload: { timeLeft: number; phase: GamePhase }) => void;
  'game:hint_revealed': (payload: { maskedWord: string; hintsRevealed: number }) => void;
  'game:round_end': (payload: RoundEndPayload) => void;
  'game:over': (payload: GameOverPayload) => void;

  'draw:start': (payload: StrokeRecord) => void;
  'draw:move': (payload: DrawMovePayload) => void;
  'draw:end': () => void;
  'draw:history': (strokes: StrokeRecord[]) => void;
  'draw:clear': () => void;

  'chat:message': (message: ChatMessage) => void;
}
