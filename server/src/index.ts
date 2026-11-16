import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { RoomManager } from './game/RoomManager.js';
import {
  ClientToServerEvents,
  ServerToClientEvents
} from './types/shared.js';

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager((roomId) => ({
  emitToRoom: (event, payload) => {
    io.to(roomId).emit(event as keyof ServerToClientEvents, payload as never);
  },
  emitToPlayer: (playerId, event, payload) => {
    io.to(playerId).emit(event as keyof ServerToClientEvents, payload as never);
  },
  onRoomUpdated: () => {
    io.emit('room:public_list', roomManager.getPublicRooms());
  }
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', publicRooms: roomManager.getPublicRooms().length });
});

app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: roomManager.getPublicRooms() });
});

io.on('connection', (socket) => {
  socket.emit('room:public_list', roomManager.getPublicRooms());

  socket.on('room:create', (payload) => {
    const { roomId } = roomManager.createRoom(
      socket.id,
      payload.playerName,
      payload.avatar,
      payload.settings || {},
      Boolean(payload.isSpectator)
    );
    socket.join(roomId);
    io.emit('room:public_list', roomManager.getPublicRooms());
  });

  socket.on('room:join', (payload) => {
    const res = roomManager.joinRoom(
      payload.roomId,
      socket.id,
      payload.playerName,
      payload.avatar,
      Boolean(payload.isSpectator)
    );
    if (!res.success || !res.room) {
      socket.emit('room:error', { message: res.reason || 'Failed to join room.' });
      return;
    }
    socket.join(res.room.roomId);
    io.emit('room:public_list', roomManager.getPublicRooms());
  });

  socket.on('room:join_random', (payload) => {
    const { roomId } = roomManager.joinRandomRoom(
      socket.id,
      payload.playerName,
      payload.avatar,
      Boolean(payload.isSpectator)
    );
    socket.join(roomId);
    io.emit('room:public_list', roomManager.getPublicRooms());
  });

  socket.on('room:leave', () => {
    const current = roomManager.getRoomBySocket(socket.id);
    if (current) socket.leave(current.roomId);
    roomManager.leaveCurrentRoom(socket.id);
    io.emit('room:public_list', roomManager.getPublicRooms());
  });

  socket.on('room:settings', (settings) => {
    roomManager.getRoomBySocket(socket.id)?.updateSettings(socket.id, settings);
  });

  socket.on('room:toggle_spectator', ({ isSpectator }) => {
    roomManager.getRoomBySocket(socket.id)?.toggleSpectator(socket.id, Boolean(isSpectator));
  });

  socket.on('room:kick', ({ targetId }) => {
    roomManager.getRoomBySocket(socket.id)?.hostKickOrBan(socket.id, targetId, false);
  });

  socket.on('room:ban', ({ targetId }) => {
    roomManager.getRoomBySocket(socket.id)?.hostKickOrBan(socket.id, targetId, true);
  });

  socket.on('room:votekick', ({ targetId }) => {
    roomManager.getRoomBySocket(socket.id)?.voteKick(socket.id, targetId);
  });

  socket.on('room:report', ({ targetId, reason }) => {
    roomManager.getRoomBySocket(socket.id)?.reportPlayer(socket.id, targetId, reason);
  });

  socket.on('game:start', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    if (!room.startGame(socket.id)) {
      socket.emit('room:error', {
        message: 'Need at least 2 active players (and host permission) to start.'
      });
    }
  });

  socket.on('game:select_word', ({ word }) => {
    roomManager.getRoomBySocket(socket.id)?.selectWord(socket.id, word);
  });

  socket.on('draw:start', (payload) => {
    roomManager.getRoomBySocket(socket.id)?.handleDrawStart(socket.id, payload);
  });

  socket.on('draw:move', (payload) => {
    roomManager.getRoomBySocket(socket.id)?.handleDrawMove(socket.id, payload);
  });

  socket.on('draw:end', () => {
    roomManager.getRoomBySocket(socket.id)?.handleDrawEnd(socket.id);
  });

  socket.on('draw:fill', (payload) => {
    roomManager.getRoomBySocket(socket.id)?.handleDrawStart(socket.id, {
      ...payload,
      tool: 'fill'
    });
  });

  socket.on('draw:undo', () => {
    roomManager.getRoomBySocket(socket.id)?.handleUndo(socket.id);
  });

  socket.on('draw:clear', () => {
    roomManager.getRoomBySocket(socket.id)?.handleClear(socket.id);
  });

  socket.on('chat:send', ({ text }) => {
    roomManager.getRoomBySocket(socket.id)?.handleChatOrGuess(socket.id, text);
  });

  socket.on('disconnect', () => {
    roomManager.leaveCurrentRoom(socket.id);
    io.emit('room:public_list', roomManager.getPublicRooms());
  });
});

httpServer.listen(PORT, () => {
  console.log(`Skribbl.io Server listening on http://localhost:${PORT}`);
});
