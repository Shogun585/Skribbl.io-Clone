import { Room } from './Room.js';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class RoomManager {
    rooms = new Map();
    socketToRoom = new Map();
    createBroadcaster;
    constructor(createBroadcaster) {
        this.createBroadcaster = createBroadcaster;
    }
    generateCode() {
        let code = '';
        do {
            code = Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
        } while (this.rooms.has(code));
        return code;
    }
    createRoom(socketId, playerName, avatar, settings = {}, isSpectator = false) {
        this.leaveCurrentRoom(socketId);
        const roomId = this.generateCode();
        const room = new Room(roomId, settings, this.createBroadcaster(roomId));
        this.rooms.set(roomId, room);
        room.addPlayer(socketId, playerName, avatar, isSpectator);
        this.socketToRoom.set(socketId, roomId);
        return { success: true, roomId, room };
    }
    joinRoom(roomIdRaw, socketId, playerName, avatar, isSpectator = false) {
        const roomId = (roomIdRaw || '').trim().toUpperCase();
        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, reason: `Room "${roomId}" does not exist.` };
        }
        this.leaveCurrentRoom(socketId);
        const res = room.addPlayer(socketId, playerName, avatar, isSpectator);
        if (!res.success) {
            return { success: false, reason: res.reason };
        }
        this.socketToRoom.set(socketId, roomId);
        return { success: true, room };
    }
    /**
     * Random Public Matchmaker (room:join_random):
     * Groups players into open public rooms sorted by capacity (highest player count first)
     * or provisions a new public room automatically.
     */
    joinRandomRoom(socketId, playerName, avatar, isSpectator = false) {
        this.leaveCurrentRoom(socketId);
        const availableRooms = Array.from(this.rooms.values()).filter((r) => r.canAcceptPublicPlayer());
        availableRooms.sort((a, b) => b.getPlayerCount() - a.getPlayerCount());
        const chosenRoom = availableRooms[0];
        if (chosenRoom) {
            const joined = chosenRoom.addPlayer(socketId, playerName, avatar, isSpectator);
            if (joined.success) {
                this.socketToRoom.set(socketId, chosenRoom.roomId);
                return { success: true, roomId: chosenRoom.roomId, room: chosenRoom };
            }
        }
        return this.createRoom(socketId, playerName, avatar, { isPrivate: false }, isSpectator);
    }
    leaveCurrentRoom(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId)
            return;
        this.socketToRoom.delete(socketId);
        const room = this.rooms.get(roomId);
        if (!room)
            return;
        room.removePlayer(socketId);
        if (room.isEmpty()) {
            room.clearAllTimers();
            this.rooms.delete(roomId);
        }
    }
    getRoomBySocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }
    getPublicRooms() {
        return Array.from(this.rooms.values())
            .filter((r) => !r.settings.isPrivate && !r.isEmpty())
            .map((r) => r.toSummary());
    }
}
