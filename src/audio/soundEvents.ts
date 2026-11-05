import type { GameState } from '../game/gameLogic';

export type GameSound = 'newHand' | 'deal' | 'flip' | 'yourTurn';
export interface SoundCue { sound: GameSound; delay: number }
export interface SoundSnapshot {
  hand: number;
  board: number;
  showdown: boolean;
  turn: string;
}

export function getSoundSnapshot(state: GameState, seat?: number): SoundSnapshot {
  const player = state.players[state.currentPlayerIndex];
  const active = !['waiting', 'showdown', 'handComplete'].includes(state.phase);
  return {
    hand: state.handNumber,
    board: state.communityCards.length,
    showdown: state.phase === 'showdown',
    turn: active && player && player.seat === seat && !player.isFolded && !player.isAllIn
      ? `${state.handNumber}:${state.phase}:${player.id}:${state.turnStartTime}` : '',
  };
}

// Compara eventos do jogo; atualizações de relógio, nome ou cor não repetem sons.
export function getSoundCues(previous: SoundSnapshot | null, current: SoundSnapshot, host = false): SoundCue[] {
  // No celular só toca o aviso da própria vez, inclusive ao entrar já na vez.
  if (!host) {
    return current.turn && current.turn !== previous?.turn ? [{ sound: 'yourTurn', delay: 0 }] : [];
  }
  if (!previous || current.hand < previous.hand) return [];
  const cues: SoundCue[] = [];
  const newHand = current.hand > previous.hand && current.hand > 0;
  if (newHand) {
    cues.push({ sound: 'newHand', delay: 0 }, { sound: 'deal', delay: 0.4 }, { sound: 'deal', delay: 0.55 });
  }
  const revealed = Math.max(0, Math.min(5, current.board) - (newHand ? 0 : previous.board));
  for (let index = 0; index < revealed; index++) {
    cues.push({ sound: 'flip', delay: (newHand ? 0.75 : 0) + index * 0.15 });
  }
  if (host && current.showdown && !previous.showdown) {
    cues.push({ sound: 'flip', delay: revealed ? revealed * 0.15 : 0 });
  }
  return cues;
}
