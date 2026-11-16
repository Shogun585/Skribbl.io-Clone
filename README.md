# Skribbl.io Clone — Aurora Edition (30-Subsystem Knowledge Graph Architecture)

Full-stack multiplayer drawing and guessing game engineered according to the **30-Subsystem System Architecture Knowledge Graph** (`docs/knowledge-graph.html`).

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
├── docs/
│   └── knowledge-graph.html             # Interactive 30-Node System Architecture Knowledge Graph
├── package.json
└── render.yaml
```

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
