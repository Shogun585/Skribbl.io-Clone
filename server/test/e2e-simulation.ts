import { io as Client } from 'socket.io-client';
import assert from 'node:assert/strict';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

async function runSimulation() {
  const alice = Client(SERVER_URL);
  const bob = Client(SERVER_URL);

  await Promise.all([
    new Promise<void>((res) => alice.on('connect', () => res())),
    new Promise<void>((res) => bob.on('connect', () => res()))
  ]);

  let createdRoomId = '';
  alice.emit('room:create', {
    playerName: 'Alice',
    avatar: '🦊',
    settings: { rounds: 2, drawTime: 60, customWords: ['pizza'], useCustomWordsOnly: true }
  });

  await new Promise<void>((resolve) => {
    alice.on('room:state', (state) => {
      if (state.roomId && !createdRoomId) {
        createdRoomId = state.roomId;
        bob.emit('room:join_random', { playerName: 'Bob', avatar: '🐼' });
      }
      if (state.players.length === 2 && state.phase === 'LOBBY') {
        alice.emit('game:start');
      }
      if (state.phase === 'WORD_SELECT') {
        alice.emit('game:select_word', { word: 'pizza' });
      }
      if (state.phase === 'DRAWING') {
        alice.emit('draw:start', { x: 0.2, y: 0.2, color: '#2CF08A', size: 8, tool: 'brush' });
        alice.emit('draw:move', { x: 0.5, y: 0.5 });
        alice.emit('draw:end');
        bob.emit('chat:send', { text: 'piza' }); // Close guess (Levenshtein = 1)
        bob.emit('chat:send', { text: 'pizza' }); // Exact match
      }
      if (state.phase === 'ROUND_END') {
        const bobPlayer = state.players.find((p) => p.name === 'Bob');
        assert.ok(bobPlayer && bobPlayer.score > 0, 'Bob should have earned points');
        resolve();
      }
    });
  });

  alice.disconnect();
  bob.disconnect();
  console.log('[e2e-simulation] Passed Alice & Bob headless WebSocket simulation!');
}

runSimulation().catch((err) => {
  console.error(err);
  process.exit(1);
});
