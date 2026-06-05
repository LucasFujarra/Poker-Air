// ================================================================
// POKER AIR — Histórico de Salas do Usuário
// Salva no localStorage as salas criadas/acessadas
// ================================================================

const STORAGE_KEY = 'poker-air-my-rooms';
const MAX_HISTORY = 20;

export interface MyRoom {
  code: string;
  role: 'host' | 'player';
  name?: string; // Nome do jogador (se player)
  seat?: number;
  createdAt: number;
  lastAccess: number;
}

// Carregar histórico
export function getMyRooms(): MyRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rooms: MyRoom[] = JSON.parse(raw);
    // Ordenar por último acesso (mais recente primeiro)
    return rooms.sort((a, b) => b.lastAccess - a.lastAccess);
  } catch {
    return [];
  }
}

// Salvar sala no histórico
export function saveMyRoom(room: MyRoom) {
  const rooms = getMyRooms();
  
  // Verificar se já existe
  const existingIdx = rooms.findIndex(r => r.code === room.code && r.role === room.role);
  
  if (existingIdx >= 0) {
    // Atualizar último acesso
    rooms[existingIdx] = { ...rooms[existingIdx], ...room, lastAccess: Date.now() };
  } else {
    // Adicionar novo
    rooms.unshift({ ...room, lastAccess: Date.now() });
  }
  
  // Limitar tamanho
  const trimmed = rooms.slice(0, MAX_HISTORY);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

// Remover sala do histórico
export function removeMyRoom(code: string) {
  const rooms = getMyRooms().filter(r => r.code !== code);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch { /* ignore */ }
}

// Formatar tempo
export function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'agora';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  
  const date = new Date(ts);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
