import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const expectedPaths = [
  'shared/types.ts',
  'scripts/sync-types.mjs',
  'client/src/types/shared.ts',
  'server/src/types/shared.ts',
  'server/src/index.ts',
  'server/src/game/RoomManager.ts',
  'server/src/game/Room.ts',
  'server/src/game/words.ts',
  'server/test/e2e-simulation.ts',
  'client/src/App.tsx',
  'client/src/index.css',
  'client/src/context/SocketContext.tsx',
  'client/src/components/Canvas.tsx',
  'client/src/components/LobbyView.tsx',
  'client/src/components/GameView.tsx',
  'client/src/components/Modals.tsx',
  'client/src/components/AvatarPicker.tsx',
  'client/src/components/ParticipantModal.tsx',
  'client/src/components/LoadingScreen.tsx',
  'client/vercel.json',
  'render.yaml'
];

for (const rel of expectedPaths) {
  const full = path.join(rootDir, rel);
  assert.ok(fs.existsSync(full), `Missing expected Knowledge Graph file: ${rel}`);
}

// Verify shared types sync integrity
const sharedContent = fs.readFileSync(path.join(rootDir, 'shared/types.ts'), 'utf8');
const clientCopy = fs.readFileSync(path.join(rootDir, 'client/src/types/shared.ts'), 'utf8');
const serverCopy = fs.readFileSync(path.join(rootDir, 'server/src/types/shared.ts'), 'utf8');
assert.equal(sharedContent, clientCopy, 'client/src/types/shared.ts must match shared/types.ts');
assert.equal(sharedContent, serverCopy, 'server/src/types/shared.ts must match shared/types.ts');

console.log('ALL 21 KNOWLEDGE GRAPH FILE & CONTRACT CHECKS PASSED');
