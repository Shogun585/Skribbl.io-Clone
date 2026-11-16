# Skribbl.io Clone

A full-stack, real-time multiplayer drawing and guessing game inspired by Skribbl.io. Built with **React 19, TypeScript, Tailwind CSS, Node.js, Express, and Socket.IO**.

## 🎨 Features

- **Real-Time Turn-Based Drawing**:
  - Low-latency continuous streaming of brush strokes via WebSockets.
  - **Resolution-Independent Canvas**: Client-side `0.0`–`1.0` coordinate normalization ensures identical stroke placement and sharpness on screens of any size (mobile, tablet, high-DPI desktop).
  - **Drawer Toolset**: Brush tool, Eraser, 18 curated colors + custom hex color picker, 4 brush thicknesses, Undo, and Clear canvas.
  - Canvas resizing handled gracefully via `ResizeObserver` with local stroke history re-rendering.
- **Rooms & Lobby Management**:
  - Create and join rooms via unique 6-character room codes or shareable invite links.
  - **Public Rooms Browser**: Browse active public games with live player counts and one-click join.
  - **Private Rooms**: Password-less, code-only invite protection.
  - **Host Controls**: Configurable rounds (2–10), draw time (30–180s), word choices (2–5), hint frequency (0–5), custom word lists, and word modes (`NORMAL`, `HIDDEN`, `COMBINATION`).
  - **Player Moderation**: Host kick and community votekick.
- **Smart Chat & Guessing System**:
  - Hidden answer masking in chat for guessers during rounds.
  - **Levenshtein Distance Proximity**: Intelligent detection of close guesses (e.g., `'ice crea'` alerts `" 'ice crea' is close! "` without spoiling the word).
  - Progressive hint reveals: Automatically reveals letters at calculated time intervals based on configured hint count.
  - Speed-weighted scoring algorithm (up to 500 points for fastest guessers, proportional bonus points for the drawer).
  - Post-guess private chatter channel for players who have already guessed the word.
- **Game State Machine & Lifecycle**:
  - `LOBBY` $\rightarrow$ `WORD_SELECTION` $\rightarrow$ `DRAWING` $\rightarrow$ `ROUND_END` $\rightarrow$ `GAME_OVER`.
  - Automatic drawer rotation across rounds.
  - Turn end scorecard displaying point deltas (`+350 pts`).
  - Game Over podium showcase (🥇 1st, 🥈 2nd, 🥉 3rd) with celebratory confetti animations (`canvas-confetti`).

---

## Architecture & Directory Structure

```text
skribbl-clone/
├── shared/
│   └── types.ts                         # Single Source of Truth (ClientToServerEvents, ServerToClientEvents, RoomState)
├── scripts/
│   └── sync-types.mjs                   # Build Automator mirroring shared/types.ts to client & server
├── client/                              # React 19 + TypeScript + Vite 6 + Tailwind v4 SPA (Vercel Edge)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AvatarPicker.tsx         # 72-emoji grid + randomizer + localStorage persistence
│   │   │   ├── Canvas.tsx               # 0.0-1.0 Coordinate Normalizer, ResizeObserver replay & Flood-Fill
│   │   │   ├── GameView.tsx             # 3-Column Arena (Scoreboard, Canvas, Chat & Guess Stream)
│   │   │   ├── LoadingScreen.tsx        # Concentric Aurora circles (#2CF08A) for matchmaking
│   │   │   ├── LobbyView.tsx            # Dropdown Room Config (ui.png) + Random Public Matchmaker
│   │   │   ├── Modals.tsx               # WordSelectModal, RoundEndModal & GameOverModal (confetti)
│   │   │   └── ParticipantModal.tsx     # Kick, Ban, Votekick, Local Mute & Report modal (options.png)
│   │   ├── context/
│   │   │   └── SocketContext.tsx        # Socket.IO Coordinator + ?room=XYZ Direct Invite URL routing
│   │   ├── types/
│   │   │   └── shared.ts                # Auto-synced from shared/types.ts
│   │   ├── utils/
│   │   │   └── floodFill.ts             # Scanline flood-fill on HTML5 Canvas ImageData
│   │   ├── App.tsx                      # Root View Switcher (LobbyView <-> GameView)
│   │   ├── index.css                    # Aurora Motion Engine (#010413 deep space + #2CF08A waves)
│   │   └── main.tsx
│   ├── vercel.json                      # Vercel SPA rewrite rules
│   └── vite.config.ts
├── server/                              # Node.js + Express 5 + Socket.IO 4.8 OOP Engine (Render)
│   ├── src/
│   │   ├── game/
│   │   │   ├── Room.ts                  # OOP State Machine, Timer Anti-Race System & Moderation
│   │   │   ├── RoomManager.ts           # Room Registry & Random Public Matchmaker (room:join_random)
│   │   │   └── words.ts                 # Categorized/Multilingual Word Engine & Levenshtein Proximity
│   │   ├── types/
│   │   │   └── shared.ts                # Auto-synced from shared/types.ts
│   │   └── index.ts                     # Express 5 + Socket.IO Gateway
│   ├── test/
│   │   ├── e2e-simulation.ts            # Headless Socket.IO E2E verifier (Alice & Bob)
│   │   └── run-verification.mjs         # Contract & file integrity test runner
│   └── render.yaml
├── package.json
└── render.yaml
```

### WebSocket Event Protocol

| Event | Direction | Payload | Description |
| --- | --- | --- | --- |
| `room:create` | Client $\rightarrow$ Server | `{ playerName, avatar, settings }` | Creates a new room and returns initial state |
| `room:join` | Client $\rightarrow$ Server | `{ roomId, playerName, avatar }` | Joins an existing room |
| `game:start` | Client $\rightarrow$ Server | _none_ | Host initiates the game |
| `game:word_options` | Server $\rightarrow$ Client | `{ words, duration }` | Emits random word pool to current drawer |
| `game:select_word` | Client $\rightarrow$ Server | `word: string` | Drawer chooses word to start turn |
| `game:turn_started` | Server $\rightarrow$ Client | `{ drawerId, drawerName, drawTime, maskedWord }` | Notifies room turn has started |
| `draw:start` | Bi-directional | `{ x, y, color, size, tool }` | Emits normalized `(0.0-1.0)` stroke origin |
| `draw:move` | Bi-directional | `{ x, y }` | Streams normalized coordinate point |
| `draw:end` | Bi-directional | `{ x, y }` | Finalizes current stroke path |
| `draw:clear` | Bi-directional | _none_ | Clears canvas |
| `draw:undo` | Bi-directional | _none_ | Removes last stroke from action stack |
| `draw:canvas_sync` | Server $\rightarrow$ Client | `DrawAction[]` | Full stroke replay for reconnecting players |
| `chat:send` | Client $\rightarrow$ Server | `message: string` | Incoming guess or chat text |
| `chat:message` | Server $\rightarrow$ Client | `ChatMessage` | Broadcasts chat, close-guess, or correct-guess |
| `game:round_end` | Server $\rightarrow$ Client | `{ word, scores }` | Reveals word and round score gains |
| `game:game_over` | Server $\rightarrow$ Client | `{ podium }` | Final standings and winner |

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js** (v18+ recommended, v20+ supported)
- **npm** (v9+)

## Quick Start

```bash
# 1. Sync shared TypeScript contracts across client and server
npm run sync-types

# 2. Start Backend (http://localhost:4000)
cd server && npm install && npm run dev

# 3. Start Frontend (http://localhost:5173)
cd client && npm install && npm run dev

# 4. Run Verification & E2E Tests
npm run test:e2e
```