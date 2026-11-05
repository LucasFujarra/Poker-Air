import type { GameState, PlayerAction } from './gameLogic';
import { addPlayer, processAction, removePlayer } from './gameLogic';

type RoomRequest =
  | { type: 'join'; name: string; seat: number; emoji?: string }
  | { type: 'leave'; playerId: string }
  | { type: 'action'; playerId: string; action: PlayerAction };

// O UID vem da chave protegida pelas regras, nunca do conteúdo do pedido.
export function applyRoomRequest(state: GameState, uid: string, request: RoomRequest): GameState {
  if (request.type === 'join') {
    if (request.emoji !== undefined && (typeof request.emoji !== 'string' || !request.emoji.trim() || request.emoji.length > 32)) return state;
    const players = [...state.players, ...state.pendingJoins];
    const ownPlayer = players.find(player => player.sessionId === uid);
    if (ownPlayer && ownPlayer.seat === request.seat && request.emoji && !ownPlayer.isBot) {
      return {
        ...state,
        players: state.players.map(player => player.sessionId === uid ? { ...player, emoji: request.emoji } : player),
        pendingJoins: state.pendingJoins.map(player => player.sessionId === uid ? { ...player, emoji: request.emoji } : player),
      };
    }
    if (players.some(player => player.sessionId === uid || player.seat === request.seat)) return state;
    return addPlayer(state, request.name, request.seat, false, undefined, uid, request.emoji);
  }
  const player = state.players.find(player => player.id === request.playerId && player.sessionId === uid && !player.isBot);
  if (!player) return state;
  if (request.type === 'leave') return removePlayer(state, player.id, true);
  if (request.type === 'action') return processAction(state, player.id, request.action);
  return state;
}
