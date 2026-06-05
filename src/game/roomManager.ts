// ================================================================
// POKER AIR — Gerenciador de Salas
// Limita a 10 salas no Firebase, reutiliza salas inativas
// Mostra apenas jogadores humanos nas listagens
// ================================================================

import { ref, get, remove, onValue, off } from 'firebase/database';
import { getFirebaseDatabase } from '../firebase/config';

const MAX_ROOMS = 10;
const INACTIVE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

export interface RoomInfo {
  id: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  playerCount: number; // Apenas jogadores humanos
  phase: string;
  isActive: boolean;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getHumanCountFromRoomState(rawState: string): { playerCount: number; phase: string } {
  let playerCount = 0;
  let phase = 'waiting';
  try {
    const state = JSON.parse(rawState);
    playerCount = state.players?.filter((p: { isBot?: boolean }) => !p.isBot).length || 0;
    phase = state.phase || 'waiting';
  } catch {
    // ignore
  }
  return { playerCount, phase };
}

export async function listRooms(): Promise<RoomInfo[]> {
  const db = getFirebaseDatabase();
  if (!db) return [];

  try {
    const snapshot = await get(ref(db, 'rooms'));
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const now = Date.now();
    const rooms: RoomInfo[] = [];

    for (const [code, roomData] of Object.entries(data)) {
      const room = roomData as { state?: string; ts?: number; updatedAt?: number; createdAt?: number };
      if (!room?.state) continue;

      const updatedAt = room.ts || room.updatedAt || 0;
      const { playerCount, phase } = getHumanCountFromRoomState(room.state);

      rooms.push({
        id: code,
        code,
        createdAt: room.createdAt || updatedAt,
        updatedAt,
        playerCount,
        phase,
        isActive: (now - updatedAt) < INACTIVE_TIMEOUT_MS,
      });
    }

    return rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('❌ Erro ao listar salas:', error);
    return [];
  }
}

export function subscribeToRooms(callback: (rooms: RoomInfo[]) => void): () => void {
  const db = getFirebaseDatabase();
  if (!db) return () => {};

  const roomsRef = ref(db, 'rooms');
  const handler = onValue(roomsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.val();
    const now = Date.now();
    const rooms: RoomInfo[] = [];

    for (const [code, roomData] of Object.entries(data)) {
      const room = roomData as { state?: string; ts?: number; updatedAt?: number; createdAt?: number };
      if (!room?.state) continue;

      const updatedAt = room.ts || room.updatedAt || 0;
      const { playerCount, phase } = getHumanCountFromRoomState(room.state);

      rooms.push({
        id: code,
        code,
        createdAt: room.createdAt || updatedAt,
        updatedAt,
        playerCount,
        phase,
        isActive: (now - updatedAt) < INACTIVE_TIMEOUT_MS,
      });
    }

    callback(rooms.sort((a, b) => b.updatedAt - a.updatedAt));
  });

  return () => off(roomsRef, 'value', handler);
}

export async function createRoom(): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  const rooms = await listRooms();
  const inactiveRooms = rooms.filter(r => !r.isActive);

  if (rooms.length >= MAX_ROOMS && inactiveRooms.length === 0) {
    return { ok: false, reason: 'Todas as 10 salas estão em uso. Tente novamente em alguns minutos.' };
  }

  if (rooms.length >= MAX_ROOMS && inactiveRooms.length > 0) {
    const oldest = inactiveRooms[inactiveRooms.length - 1];
    const db = getFirebaseDatabase();
    if (db) {
      try {
        await remove(ref(db, `rooms/${oldest.code}`));
      } catch {
        // ignore
      }
    }
  }

  const existingCodes = new Set(rooms.map(r => r.code));
  let code = generateCode();
  let tries = 0;
  while (existingCodes.has(code) && tries < 20) {
    code = generateCode();
    tries++;
  }

  return { ok: true, code };
}

export async function deleteRoom(code: string) {
  const db = getFirebaseDatabase();
  if (!db) return;
  try {
    await remove(ref(db, `rooms/${code}`));
  } catch {
    // ignore
  }
}

export async function roomExists(code: string): Promise<boolean> {
  const db = getFirebaseDatabase();
  if (!db) return false;
  try {
    const snapshot = await get(ref(db, `rooms/${code}`));
    if (!snapshot.exists()) return false;
    const data = snapshot.val();
    const updatedAt = data.ts || 0;
    return (Date.now() - updatedAt) < INACTIVE_TIMEOUT_MS;
  } catch {
    return false;
  }
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}
