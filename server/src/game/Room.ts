import {
  ChatMessage,
  DrawMovePayload,
  DrawStartPayload,
  GameOverPayload,
  GamePhase,
  PlayerState,
  RoomSettings,
  RoomState,
  RoomSummary,
  RoundEndPayload,
  StrokeRecord
} from '../types/shared.js';
import {
  evaluateGuess,
  getRandomWords,
  maskWord,
  pickNextHintIndex
} from './words.js';

export interface RoomBroadcaster {
  emitToRoom: <K extends string>(event: K, payload: unknown) => void;
  emitToPlayer: <K extends string>(playerId: string, event: K, payload: unknown) => void;
  onRoomUpdated: (room: Room) => void;
}

export interface InternalPlayer extends PlayerState {
  voters: Set<string>;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  language: 'English',
  drawTime: 80,
  rounds: 3,
  wordMode: 'normal',
  wordCount: 3,
  hints: 2,
  category: 'all',
  isPrivate: false,
  customWords: [],
  useCustomWordsOnly: false
};

export class Room {
  public readonly roomId: string;
  public settings: RoomSettings;
  private phase: GamePhase = 'LOBBY';
  private players: Map<string, InternalPlayer> = new Map();
  private bannedIds: Set<string> = new Set();
  private reports: Array<{ reporterId: string; targetId: string; reason: string; timestamp: number }> = [];

  private currentRound: number = 1;
  private turnQueue: string[] = [];
  private currentDrawerId: string | null = null;
  private currentWord: string = '';
  private wordOptions: string[] = [];
  private revealedIndices: Set<number> = new Set();
  private usedWords: Set<string> = new Set();
  private strokes: StrokeRecord[] = [];
  private activeStroke: StrokeRecord | null = null;

  private phaseEndTime: number | null = null;
  private timeLeft: number = 0;

  // Timer Anti-Race System handles
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private wordSelectTimeout: ReturnType<typeof setTimeout> | null = null;
  private roundEndTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly broadcaster: RoomBroadcaster;

  constructor(
    roomId: string,
    settings: Partial<RoomSettings>,
    broadcaster: RoomBroadcaster
  ) {
    this.roomId = roomId;
    this.settings = Room.sanitizeSettings({ ...DEFAULT_SETTINGS, ...settings });
    this.broadcaster = broadcaster;
  }

  public static sanitizeSettings(raw: Partial<RoomSettings>): RoomSettings {
    const clamp = (val: number | undefined, min: number, max: number, fallback: number) =>
      typeof val === 'number' && !Number.isNaN(val)
        ? Math.max(min, Math.min(max, Math.round(val)))
        : fallback;

    return {
      maxPlayers: clamp(raw.maxPlayers, 2, 20, DEFAULT_SETTINGS.maxPlayers),
      language:
        raw.language && ['English', 'Spanish', 'French', 'German', 'Hindi'].includes(raw.language)
          ? raw.language
          : 'English',
      drawTime: clamp(raw.drawTime, 15, 240, DEFAULT_SETTINGS.drawTime),
      rounds: clamp(raw.rounds, 2, 10, DEFAULT_SETTINGS.rounds),
      wordMode:
        raw.wordMode && ['normal', 'hidden', 'combination'].includes(raw.wordMode)
          ? raw.wordMode
          : 'normal',
      wordCount: clamp(raw.wordCount, 1, 5, DEFAULT_SETTINGS.wordCount),
      hints: clamp(raw.hints, 0, 5, DEFAULT_SETTINGS.hints),
      category:
        raw.category &&
        ['all', 'animals', 'food', 'objects', 'space', 'actions', 'tech'].includes(raw.category)
          ? raw.category
          : 'all',
      isPrivate: Boolean(raw.isPrivate),
      customWords: Array.isArray(raw.customWords)
        ? raw.customWords.map((w) => String(w).trim()).filter(Boolean).slice(0, 100)
        : [],
      useCustomWordsOnly: Boolean(raw.useCustomWordsOnly)
    };
  }

  /**
   * Timer Anti-Race System: Explicitly cancels all intervals and timeouts
   * before any state transition or room teardown.
   */
  public clearAllTimers(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.wordSelectTimeout) {
      clearTimeout(this.wordSelectTimeout);
      this.wordSelectTimeout = null;
    }
    if (this.roundEndTimeout) {
      clearTimeout(this.roundEndTimeout);
      this.roundEndTimeout = null;
    }
  }

  public getPlayerCount(): number {
    return this.getActivePlayers().length;
  }

  public getTotalParticipantCount(): number {
    return this.players.size;
  }

  public isEmpty(): boolean {
    return this.players.size === 0;
  }

  public canAcceptPublicPlayer(): boolean {
    return !this.settings.isPrivate && this.getPlayerCount() < this.settings.maxPlayers;
  }

  public getActivePlayers(): InternalPlayer[] {
    return Array.from(this.players.values()).filter((p) => !p.isSpectator);
  }

  public addPlayer(
    socketId: string,
    playerName: string,
    avatar: string = '🐶',
    isSpectator: boolean = false
  ): { success: boolean; reason?: string; player?: PlayerState } {
    if (this.bannedIds.has(socketId)) {
      return { success: false, reason: 'You are banned from this room.' };
    }
    if (!isSpectator && this.getPlayerCount() >= this.settings.maxPlayers) {
      return { success: false, reason: 'Room is full. Join as a Spectator instead!' };
    }

    const isFirst = this.players.size === 0;
    const player: InternalPlayer = {
      id: socketId,
      name: (playerName || 'Artist').trim().slice(0, 20) || 'Artist',
      avatar: avatar || '🐶',
      score: 0,
      roundScore: 0,
      isHost: isFirst,
      isSpectator: Boolean(isSpectator),
      hasGuessed: false,
      votekickCount: 0,
      voters: new Set()
    };

    this.players.set(socketId, player);
    this.emitSystemChat(`${player.avatar} ${player.name} joined the room.`);
    this.syncRoomState();

    // Send existing stroke buffer to late joiners / spectators
    if (this.strokes.length > 0) {
      this.broadcaster.emitToPlayer(socketId, 'draw:history', this.strokes);
    }

    return { success: true, player: this.toPlayerState(player) };
  }

  public removePlayer(socketId: string, reasonMessage?: string): void {
    const removed = this.players.get(socketId);
    if (!removed) return;
    this.players.delete(socketId);

    for (const p of this.players.values()) {
      p.voters.delete(socketId);
      p.votekickCount = p.voters.size;
    }

    if (removed.isHost && this.players.size > 0) {
      const nextHost = this.getActivePlayers()[0] || Array.from(this.players.values())[0];
      if (nextHost) {
        nextHost.isHost = true;
        this.emitSystemChat(`👑 ${nextHost.name} is now the room host.`);
      }
    }

    if (reasonMessage) {
      this.emitSystemChat(reasonMessage);
    } else {
      this.emitSystemChat(`${removed.name} left the room.`);
    }

    this.turnQueue = this.turnQueue.filter((id) => id !== socketId);

    if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') {
      if (this.getPlayerCount() < 2) {
        this.endGame();
        return;
      }
      if (socketId === this.currentDrawerId) {
        this.endRound('Drawer disconnected!');
        return;
      }
      if (this.phase === 'DRAWING' && this.haveAllGuessersSolved()) {
        this.endRound('Everyone guessed the word!');
        return;
      }
    }

    this.syncRoomState();
  }

  public updateSettings(socketId: string, partial: Partial<RoomSettings>): boolean {
    const p = this.players.get(socketId);
    if (!p || !p.isHost) return false;
    this.settings = Room.sanitizeSettings({ ...this.settings, ...partial });
    this.syncRoomState();
    return true;
  }

  public toggleSpectator(socketId: string, isSpectator: boolean): boolean {
    const p = this.players.get(socketId);
    if (!p) return false;
    if (!isSpectator && this.getPlayerCount() >= this.settings.maxPlayers) {
      return false;
    }
    p.isSpectator = isSpectator;
    if (isSpectator && socketId === this.currentDrawerId) {
      this.endRound('Drawer switched to Spectator mode.');
      return true;
    }
    this.syncRoomState();
    return true;
  }

  // --- MODERATION SYSTEM (Kick, Ban, Votekick, Report) ---
  public hostKickOrBan(hostId: string, targetId: string, ban: boolean): boolean {
    const host = this.players.get(hostId);
    const target = this.players.get(targetId);
    if (!host || !host.isHost || !target || hostId === targetId) return false;

    if (ban) {
      this.bannedIds.add(targetId);
    }
    this.broadcaster.emitToPlayer(targetId, 'room:kicked', {
      reason: ban ? 'You were banned by the room host.' : 'You were kicked by the room host.',
      banned: ban
    });
    this.removePlayer(
      targetId,
      ban ? `🚫 ${target.name} was banned by the host.` : `👢 ${target.name} was kicked by the host.`
    );
    return true;
  }

  public voteKick(voterId: string, targetId: string): { kicked: boolean; votes: number; required: number } {
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);
    if (!voter || !target || voterId === targetId) {
      return { kicked: false, votes: 0, required: 99 };
    }

    target.voters.add(voterId);
    target.votekickCount = target.voters.size;
    const required = Math.floor(this.players.size / 2) + 1;

    if (target.votekickCount >= required) {
      this.bannedIds.add(targetId);
      this.broadcaster.emitToPlayer(targetId, 'room:kicked', {
        reason: 'You were voted out by the room.',
        banned: true
      });
      this.removePlayer(targetId, `⚖️ ${target.name} was removed by votekick (${target.votekickCount}/${required}).`);
      return { kicked: true, votes: target.votekickCount, required };
    }

    this.emitSystemChat(
      `🗳️ ${voter.name} voted to kick ${target.name} (${target.votekickCount}/${required}).`
    );
    this.syncRoomState();
    return { kicked: false, votes: target.votekickCount, required };
  }

  public reportPlayer(reporterId: string, targetId: string, reason: string): void {
    const reporter = this.players.get(reporterId);
    const target = this.players.get(targetId);
    if (!reporter || !target) return;
    this.reports.push({
      reporterId,
      targetId,
      reason: (reason || 'Inappropriate behavior').slice(0, 120),
      timestamp: Date.now()
    });
  }

  // --- GAMEPLAY & STATE MACHINE ---
  public startGame(requesterId?: string): boolean {
    if (requesterId) {
      const p = this.players.get(requesterId);
      if (!p || !p.isHost) return false;
    }
    const active = this.getActivePlayers();
    if (active.length < 2) return false;

    this.clearAllTimers();
    this.usedWords.clear();
    this.currentRound = 1;
    for (const p of this.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
    }

    this.turnQueue = active.map((p) => p.id);
    this.startNextTurn();
    return true;
  }

  public startNextTurn(): void {
    this.clearAllTimers();
    this.strokes = [];
    this.activeStroke = null;
    this.currentWord = '';
    this.revealedIndices.clear();

    for (const p of this.players.values()) {
      p.roundScore = 0;
      p.hasGuessed = false;
    }

    this.turnQueue = this.turnQueue.filter((id) => {
      const p = this.players.get(id);
      return p && !p.isSpectator;
    });

    if (this.turnQueue.length === 0) {
      if (this.currentRound < this.settings.rounds) {
        this.currentRound++;
        const active = this.getActivePlayers();
        if (active.length < 2) {
          this.endGame();
          return;
        }
        this.turnQueue = active.map((p) => p.id);
      } else {
        this.endGame();
        return;
      }
    }

    if (this.getPlayerCount() < 2) {
      this.endGame();
      return;
    }

    this.currentDrawerId = this.turnQueue.shift() || null;
    if (!this.currentDrawerId) {
      this.endGame();
      return;
    }

    this.phase = 'WORD_SELECT';
    this.wordOptions = getRandomWords(
      this.settings.wordCount,
      this.settings.customWords,
      this.settings.useCustomWordsOnly,
      this.settings.category,
      this.settings.wordMode,
      this.settings.language,
      this.usedWords
    );

    const selectSeconds = 15;
    this.timeLeft = selectSeconds;
    this.phaseEndTime = Date.now() + selectSeconds * 1000;

    this.broadcaster.emitToPlayer(this.currentDrawerId, 'game:word_options', {
      words: this.wordOptions,
      timeLeft: selectSeconds
    });

    this.syncRoomState();

    this.tickInterval = setInterval(() => {
      this.timeLeft = Math.max(0, Math.ceil(((this.phaseEndTime ?? Date.now()) - Date.now()) / 1000));
      this.broadcaster.emitToRoom('game:tick', { timeLeft: this.timeLeft, phase: this.phase });
    }, 1000);

    this.wordSelectTimeout = setTimeout(() => {
      if (this.phase === 'WORD_SELECT' && this.currentDrawerId && this.wordOptions.length > 0) {
        const randomChoice =
          this.wordOptions[Math.floor(Math.random() * this.wordOptions.length)];
        this.selectWord(this.currentDrawerId, randomChoice);
      }
    }, selectSeconds * 1000);
  }

  public selectWord(playerId: string, word: string): boolean {
    if (this.phase !== 'WORD_SELECT' || playerId !== this.currentDrawerId) return false;
    const clean = word.trim().toLowerCase();
    const chosen =
      this.wordOptions.find((w) => w.toLowerCase() === clean) || this.wordOptions[0];
    if (!chosen) return false;

    this.clearAllTimers();
    this.currentWord = chosen;
    this.usedWords.add(chosen);
    this.phase = 'DRAWING';
    this.timeLeft = this.settings.drawTime;
    this.phaseEndTime = Date.now() + this.settings.drawTime * 1000;

    const drawer = this.players.get(this.currentDrawerId);
    const publicMask = maskWord(this.currentWord, this.revealedIndices, this.settings.wordMode);
    const lengths =
      this.settings.wordMode === 'hidden'
        ? []
        : this.currentWord.split(' ').map((part) => part.length);

    this.broadcaster.emitToRoom('game:turn_started', {
      drawerId: this.currentDrawerId,
      drawerName: drawer ? drawer.name : 'Drawer',
      drawTime: this.settings.drawTime,
      maskedWord: publicMask,
      wordLengths: lengths
    });

    this.broadcaster.emitToRoom('draw:clear', undefined);
    this.syncRoomState();

    const maxHints = Math.min(5, this.settings.hints);
    const hintMoments = new Set<number>();
    if (maxHints > 0 && this.settings.wordMode !== 'hidden') {
      const step = Math.floor(this.settings.drawTime / (maxHints + 1));
      for (let i = 1; i <= maxHints; i++) {
        hintMoments.add(Math.max(3, this.settings.drawTime - step * i));
      }
    }

    this.tickInterval = setInterval(() => {
      if (this.phase !== 'DRAWING') return;
      this.timeLeft = Math.max(
        0,
        Math.ceil(((this.phaseEndTime ?? Date.now()) - Date.now()) / 1000)
      );
      this.broadcaster.emitToRoom('game:tick', {
        timeLeft: this.timeLeft,
        phase: this.phase
      });

      if (hintMoments.has(this.timeLeft)) {
        hintMoments.delete(this.timeLeft);
        const idx = pickNextHintIndex(this.currentWord, this.revealedIndices);
        if (idx !== null) {
          this.revealedIndices.add(idx);
          const updatedMask = maskWord(
            this.currentWord,
            this.revealedIndices,
            this.settings.wordMode
          );
          this.broadcaster.emitToRoom('game:hint_revealed', {
            maskedWord: updatedMask,
            hintsRevealed: this.revealedIndices.size
          });
          this.syncRoomState();
        }
      }

      if (this.timeLeft <= 0) {
        this.endRound('Time is up!');
      }
    }, 1000);

    return true;
  }

  // --- DRAWING PIPELINE ---
  public handleDrawStart(playerId: string, payload: DrawStartPayload): StrokeRecord | null {
    if (this.phase !== 'DRAWING' || playerId !== this.currentDrawerId) return null;
    const stroke: StrokeRecord = {
      id: payload.strokeId || `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool: payload.tool || 'brush',
      color: payload.color || '#18181B',
      size: payload.size || 8,
      points: [{ x: payload.x, y: payload.y }]
    };
    this.strokes.push(stroke);
    if (stroke.tool !== 'fill') {
      this.activeStroke = stroke;
    }
    this.broadcaster.emitToRoom('draw:start', stroke);
    return stroke;
  }

  public handleDrawMove(playerId: string, payload: DrawMovePayload): boolean {
    if (this.phase !== 'DRAWING' || playerId !== this.currentDrawerId || !this.activeStroke) {
      return false;
    }
    this.activeStroke.points.push({ x: payload.x, y: payload.y });
    this.broadcaster.emitToRoom('draw:move', {
      strokeId: this.activeStroke.id,
      x: payload.x,
      y: payload.y
    });
    return true;
  }

  public handleDrawEnd(playerId: string): void {
    if (playerId !== this.currentDrawerId) return;
    this.activeStroke = null;
    this.broadcaster.emitToRoom('draw:end', undefined);
  }

  public handleUndo(playerId: string): boolean {
    if (this.phase !== 'DRAWING' || playerId !== this.currentDrawerId) return false;
    this.strokes.pop();
    this.broadcaster.emitToRoom('draw:history', this.strokes);
    return true;
  }

  public handleClear(playerId: string): boolean {
    if (this.phase !== 'DRAWING' || playerId !== this.currentDrawerId) return false;
    this.strokes = [];
    this.broadcaster.emitToRoom('draw:clear', undefined);
    return true;
  }

  // --- CHAT & GUESS STREAM ---
  public handleChatOrGuess(playerId: string, rawText: string): void {
    const sender = this.players.get(playerId);
    if (!sender) return;
    const text = (rawText || '').trim().slice(0, 140);
    if (!text) return;

    if (
      this.phase === 'DRAWING' &&
      !sender.isSpectator &&
      playerId !== this.currentDrawerId &&
      !sender.hasGuessed
    ) {
      const outcome = evaluateGuess(text, this.currentWord);
      if (outcome === 'exact') {
        sender.hasGuessed = true;
        const ratio = Math.min(1, Math.max(0, this.timeLeft / Math.max(1, this.settings.drawTime)));
        const firstBonus =
          this.getActivePlayers().filter((p) => p.hasGuessed).length === 1 ? 75 : 0;
        const points = Math.max(60, Math.round(100 + 350 * ratio) + firstBonus);

        sender.roundScore += points;
        sender.score += points;

        if (this.currentDrawerId) {
          const drawer = this.players.get(this.currentDrawerId);
          if (drawer) {
            drawer.roundScore += 85;
            drawer.score += 85;
          }
        }

        const correctMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          senderId: sender.id,
          senderName: sender.name,
          senderAvatar: sender.avatar,
          text: `${sender.name} guessed the word! (+${points} pts)`,
          type: 'correct_guess',
          timestamp: Date.now()
        };
        this.broadcaster.emitToRoom('chat:message', correctMsg);

        if (this.haveAllGuessersSolved()) {
          this.endRound('Everyone guessed the word!');
        } else {
          this.syncRoomState();
        }
        return;
      }

      if (outcome === 'close_guess') {
        const closeMsg: ChatMessage = {
          id: `msg-${Date.now()}-close`,
          senderId: sender.id,
          senderName: sender.name,
          senderAvatar: sender.avatar,
          text: `"${text}" is very close!`,
          type: 'close_guess',
          timestamp: Date.now()
        };
        this.broadcaster.emitToPlayer(sender.id, 'chat:message', closeMsg);
      }
    }

    // Prevent answer leaks from drawer, spectators, or players who already solved
    if (
      this.phase === 'DRAWING' &&
      this.currentWord &&
      text.toLowerCase().includes(this.currentWord.toLowerCase())
    ) {
      this.broadcaster.emitToPlayer(sender.id, 'chat:message', {
        id: `msg-${Date.now()}-leak`,
        senderId: 'system',
        senderName: 'System',
        senderAvatar: '🛡️',
        text: 'Message blocked because it contains the secret word!',
        type: 'system',
        timestamp: Date.now()
      } satisfies ChatMessage);
      return;
    }

    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      text,
      type: sender.isSpectator ? 'spectator' : 'chat',
      timestamp: Date.now()
    };
    this.broadcaster.emitToRoom('chat:message', chatMsg);
  }

  private haveAllGuessersSolved(): boolean {
    const guessers = this.getActivePlayers().filter((p) => p.id !== this.currentDrawerId);
    return guessers.length > 0 && guessers.every((p) => p.hasGuessed);
  }

  public endRound(reason: string): void {
    if (this.phase === 'ROUND_END' || this.phase === 'GAME_OVER') return;
    this.clearAllTimers();
    this.phase = 'ROUND_END';
    this.timeLeft = 5;
    this.phaseEndTime = Date.now() + 5000;

    const payload: RoundEndPayload = {
      word: this.currentWord,
      reason,
      scores: Array.from(this.players.values()).map((p) => this.toPlayerState(p)),
      nextDrawerId: this.turnQueue[0] || null
    };
    this.broadcaster.emitToRoom('game:round_end', payload);
    this.syncRoomState();

    this.roundEndTimeout = setTimeout(() => {
      this.startNextTurn();
    }, 5000);
  }

  public endGame(): void {
    this.clearAllTimers();
    this.phase = 'GAME_OVER';
    this.timeLeft = 0;
    this.phaseEndTime = null;
    this.currentDrawerId = null;

    const podium = Array.from(this.players.values())
      .map((p) => this.toPlayerState(p))
      .sort((a, b) => b.score - a.score);

    const payload: GameOverPayload = {
      winner: podium[0] || null,
      podium
    };
    this.broadcaster.emitToRoom('game:over', payload);
    this.syncRoomState();
  }

  private emitSystemChat(text: string): void {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random()}`,
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '✨',
      text,
      type: 'system',
      timestamp: Date.now()
    };
    this.broadcaster.emitToRoom('chat:message', msg);
  }

  private toPlayerState(p: InternalPlayer): PlayerState {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      roundScore: p.roundScore,
      isHost: p.isHost,
      isSpectator: p.isSpectator,
      hasGuessed: p.hasGuessed,
      votekickCount: p.votekickCount
    };
  }

  public getStateForPlayer(viewerId: string): RoomState {
    const viewer = this.players.get(viewerId);
    const canSeeFullWord =
      this.phase === 'ROUND_END' ||
      this.phase === 'GAME_OVER' ||
      viewerId === this.currentDrawerId ||
      Boolean(viewer?.hasGuessed);

    const masked =
      this.phase === 'DRAWING' || this.phase === 'ROUND_END' || this.phase === 'GAME_OVER'
        ? canSeeFullWord
          ? this.currentWord.toUpperCase()
          : maskWord(this.currentWord, this.revealedIndices, this.settings.wordMode)
        : '';

    const drawer = this.currentDrawerId ? this.players.get(this.currentDrawerId) : null;

    return {
      roomId: this.roomId,
      settings: this.settings,
      phase: this.phase,
      currentRound: this.currentRound,
      maxRounds: this.settings.rounds,
      currentDrawerId: this.currentDrawerId,
      currentDrawerName: drawer ? drawer.name : null,
      maskedWord: masked,
      wordLengths:
        this.currentWord && this.settings.wordMode !== 'hidden'
          ? this.currentWord.split(' ').map((w) => w.length)
          : [],
      hintsRevealed: this.revealedIndices.size,
      timeLeft: this.timeLeft,
      phaseEndTime: this.phaseEndTime,
      players: Array.from(this.players.values()).map((p) => this.toPlayerState(p)),
      strokes: this.strokes
    };
  }

  public toSummary(): RoomSummary {
    const all = Array.from(this.players.values());
    const host = all.find((p) => p.isHost) || all[0];
    const spectators = all.filter((p) => p.isSpectator).length;
    return {
      roomId: this.roomId,
      hostName: host ? host.name : 'Host',
      playerCount: all.length - spectators,
      spectatorCount: spectators,
      maxPlayers: this.settings.maxPlayers,
      phase: this.phase,
      currentRound: this.currentRound,
      maxRounds: this.settings.rounds,
      language: this.settings.language,
      category: this.settings.category
    };
  }

  public syncRoomState(): void {
    for (const playerId of this.players.keys()) {
      this.broadcaster.emitToPlayer(playerId, 'room:state', this.getStateForPlayer(playerId));
    }
    this.broadcaster.onRoomUpdated(this);
  }
}
