// ================================================================
// POKER AIR — Gerenciador de Salas
// Limita a 10 salas no Firebase, reutiliza salas inativas
// Mostra apenas jogadores humanos nas listagens
// ================================================================

import { ref, get, remove, onValue, update } from 'firebase/database';
import { getFirebaseDatabase, ensureFirebaseUser } from '../firebase/config';

const MAX_ROOMS = 10;
const INACTIVE_TIMEOUT_MS = 10 * 60 * 1000;

export interface RoomInfo {
  id: string;
  code: string;
  createdAt: number;
  updatedAt: number;
  playerCount: number;
  phase: string;
  isActive: boolean;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), value => chars[value % chars.length]).join('');
}

function parseRooms(data: Record<string, Omit<RoomInfo, 'id' | 'isActive'>> | null): RoomInfo[] {
  return Object.entries(data ?? {}).map(([code, room]) => ({
    ...room, id: code, code, createdAt: room.createdAt || room.updatedAt,
    isActive: Date.now() - room.updatedAt < INACTIVE_TIMEOUT_MS,
  })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listRooms(): Promise<RoomInfo[]> {
  const uid = await ensureFirebaseUser();
  const db = getFirebaseDatabase();
  if (!db) return [];
  return parseRooms((await get(ref(db, `roomDirectory/${uid}`))).val());
}

export function subscribeToRooms(callback: (rooms: RoomInfo[]) => void): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;
  void ensureFirebaseUser().then(uid => {
    const db = getFirebaseDatabase();
    if (!db || cancelled) return;
    unsubscribe = onValue(ref(db, `roomDirectory/${uid}`), snapshot => callback(parseRooms(snapshot.val())),
      error => console.error('Erro ao listar suas salas:', error));
  }).catch(error => console.error('Erro de autenticação:', error));
  return () => { cancelled = true; unsubscribe?.(); };
}

export async function createRoom(): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  try {
    const rooms = await listRooms();
    if (rooms.length >= MAX_ROOMS) {
      const oldest = [...rooms].reverse().find(room => !room.isActive);
      if (!oldest) return { ok: false, reason: 'Suas 10 salas estão em uso.' };
      await deleteRoom(oldest.code);
    }
    const db = getFirebaseDatabase();
    if (!db) throw new Error('Firebase indisponível');
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateCode();
      if (!(await get(ref(db, `rooms/${code}/ts`))).exists()) return { ok: true, code };
    }
    return { ok: false, reason: 'Não foi possível gerar um código. Tente novamente.' };
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    return { ok: false, reason: 'Não foi possível criar a sala. Verifique a conexão e as permissões.' };
  }
}

export async function deleteRoom(code: string) {
  const uid = await ensureFirebaseUser();
  const db = getFirebaseDatabase();
  if (!db) return;
  // A regra só permite apagar salas do próprio anfitrião.
  await remove(ref(db, `rooms/${code}`));
  await update(ref(db, `roomDirectory/${uid}`), { [code]: null });
}

export async function roomExists(code: string): Promise<boolean> {
  if (!/^[A-Z2-9]{6}$/.test(code)) return false;
  try {
    await ensureFirebaseUser();
    const db = getFirebaseDatabase();
    if (!db) return false;
    const snapshot = await get(ref(db, `rooms/${code}/ts`));
    return snapshot.exists() && Date.now() - snapshot.val() < INACTIVE_TIMEOUT_MS;
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
