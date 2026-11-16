import { Room, RoomBroadcaster } from './Room.js';
import { RoomSettings, RoomSummary } from '../types/shared.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private readonly rooms: Map<string, Room> = new Map();
  private readonly socketToRoom: Map<string, string> = new Map();
  private readonly createBroadcaster: (roomId: string) => RoomBroadcaster;

  constructor(createBroadcaster: (roomId: string) => RoomBroadcaster) {
    this.createBroadcaster = createBroadcaster;
  }

  public generateCode(): string {
    let code = '';
    do {
      code = Array.from({ length: 6 }, () =>
        CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(
    socketId: string,
    playerName: string,
    avatar: string,
    settings: Partial<RoomSettings> = {},
    isSpectator: boolean = false
  ): { success: boolean; roomId: string; room: Room } {
    this.leaveCurrentRoom(socketId);
    const roomId = this.generateCode();
    const room = new Room(roomId, settings, this.createBroadcaster(roomId));
    this.rooms.set(roomId, room);
    room.addPlayer(socketId, playerName, avatar, isSpectator);
    this.socketToRoom.set(socketId, roomId);
    return { success: true, roomId, room };
  }

  public joinRoom(
    roomIdRaw: string,
    socketId: string,
    playerName: string,
    avatar: string,
    isSpectator: boolean = false
  ): { success: boolean; reason?: string; room?: Room } {
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
  public joinRandomRoom(
    socketId: string,
    playerName: string,
    avatar: string,
    isSpectator: boolean = false
  ): { success: boolean; roomId: string; room: Room } {
    this.leaveCurrentRoom(socketId);
    const availableRooms = Array.from(this.rooms.values()).filter((r) =>
      r.canAcceptPublicPlayer()
    );
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

  public leaveCurrentRoom(socketId: string): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;
    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(socketId);
    if (room.isEmpty()) {
      room.clearAllTimers();
      this.rooms.delete(roomId);
    }
  }

  public getRoomBySocket(socketId: string): Room | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  public getPublicRooms(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter((r) => !r.settings.isPrivate && !r.isEmpty())
      .map((r) => r.toSummary());
  }
}
