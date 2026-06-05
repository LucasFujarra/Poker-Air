// ================================================================
// POKER AIR — Motor do Jogo Texas Hold'em
// Lógica completa do jogo incluindo apostas, side pots, etc.
// ================================================================

import type { Card, HandResult } from './handEvaluator';
import {
  HAND_NAMES,
  createDeck, shuffleDeck, evaluateBestHand, compareHands
} from './handEvaluator';

// Dificuldade do bot
export type BotDifficulty = 'easy' | 'medium' | 'hard';

// Estado de cada jogador
export interface Player {
  id: string;
  name: string;
  seat: number; // 0-8
  chips: number;
  holeCards: Card[];
  currentBet: number; // Aposta na rodada atual
  totalBetInHand: number; // Total apostado na mão inteira (para side pots)
  isFolded: boolean;
  isAllIn: boolean;
  isConnected: boolean;
  isSittingOut: boolean;
  hasActed: boolean; // Se já agiu nesta rodada de apostas
  isBot: boolean; // Se é um bot automático
  botDifficulty?: BotDifficulty; // Dificuldade do bot
  handResult?: HandResult;
  isWinner?: boolean;
  winAmount?: number;
}

// Fases do jogo
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handComplete';

// Ação do jogador
export interface PlayerAction {
  type: 'fold' | 'check' | 'call' | 'raise' | 'allin';
  amount?: number;
}

// Side pot para situações de all-in
export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

// Configurações do jogo
export interface GameConfig {
  initialChips: number;
  smallBlind: number;
  bigBlind: number;
  turnTimer: number; // segundos
}

// Jogador pendente (entra na próxima mão)
export interface PendingPlayer {
  name: string;
  seat: number;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
}

// Estado completo do jogo
export interface GameState {
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  deckIndex: number;
  pot: number;
  sidePots: SidePot[];
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  phase: GamePhase;
  currentBet: number;
  minRaise: number;
  lastRaiseSize: number;
  config: GameConfig;
  handNumber: number;
  winners: { playerId: string; amount: number; hand: string }[];
  lastAction?: { playerId: string; action: string; amount?: number };
  turnStartTime: number;
  revealedCards: Card[];
  pendingJoins: PendingPlayer[];   // Jogadores que entram na próxima mão
  pendingRemoves: string[];         // IDs de bots para remover na próxima mão
  showdownEndTime: number;          // Quando o showdown termina (para auto next hand)
}

// Configuração padrão
export const DEFAULT_CONFIG: GameConfig = {
  initialChips: 10000,
  smallBlind: 100,
  bigBlind: 200,
  turnTimer: 30,
};

// Criar estado inicial do jogo
export function createGameState(config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    players: [],
    communityCards: [],
    deck: [],
    deckIndex: 0,
    pot: 0,
    sidePots: [],
    currentPlayerIndex: -1,
    dealerIndex: -1,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    phase: 'waiting',
    currentBet: 0,
    minRaise: config.bigBlind,
    lastRaiseSize: config.bigBlind,
    config,
    handNumber: 0,
    winners: [],
    turnStartTime: 0,
    revealedCards: [],
    pendingJoins: [],
    pendingRemoves: [],
    showdownEndTime: 0,
  };
}

// Verificar se a mão está em andamento
function isHandInProgress(state: GameState): boolean {
  return state.phase !== 'waiting' && state.phase !== 'showdown' && state.phase !== 'handComplete';
}

// Adicionar jogador — enfileira se mão em andamento
export function addPlayer(
  state: GameState, 
  name: string, 
  seat: number, 
  isBot: boolean = false, 
  botDifficulty?: BotDifficulty
): GameState {
  // Verificar se assento já ocupado ou pendente
  if (state.players.find(p => p.seat === seat)) return state;
  if (state.pendingJoins.find(p => p.seat === seat)) return state;
  if (state.players.length + state.pendingJoins.length >= 9) return state;
  
  // Se mão em andamento, enfileirar
  if (isHandInProgress(state)) {
    return {
      ...state,
      pendingJoins: [...state.pendingJoins, { name, seat, isBot, botDifficulty }],
    };
  }

  // Adicionar direto
  const id = `player_${seat}_${Date.now()}`;
  const newPlayer: Player = {
    id, name, seat,
    chips: state.config.initialChips,
    holeCards: [], currentBet: 0, totalBetInHand: 0,
    isFolded: false, isAllIn: false, isConnected: true,
    isSittingOut: false, hasActed: false, isBot, botDifficulty,
  };
  
  return {
    ...state,
    players: [...state.players, newPlayer].sort((a, b) => a.seat - b.seat),
  };
}

// Remover jogador — bots enfileiram se mão em andamento, humanos saem direto
export function removePlayer(state: GameState, playerId: string, isLeaving: boolean = false): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Se mão em andamento e é bot, enfileirar remoção
  if (isHandInProgress(state) && player.isBot && !isLeaving) {
    if (state.pendingRemoves.includes(playerId)) return state;
    return {
      ...state,
      pendingRemoves: [...state.pendingRemoves, playerId],
    };
  }
  
  // Se jogador humano sai durante a mão, fold primeiro
  if (isHandInProgress(state) && !player.isFolded && !player.isBot) {
    const folded = processAction(state, playerId, { type: 'fold' });
    return {
      ...folded,
      players: folded.players.filter(p => p.id !== playerId),
    };
  }

  return {
    ...state,
    players: state.players.filter(p => p.id !== playerId),
    pendingRemoves: state.pendingRemoves.filter(id => id !== playerId),
  };
}

// Processar filas pendentes (chamado ao iniciar nova mão)
function processPendingQueues(state: GameState): GameState {
  let newState = { ...state };
  
  // Remover bots pendentes
  for (const id of newState.pendingRemoves) {
    newState = {
      ...newState,
      players: newState.players.filter(p => p.id !== id),
    };
  }
  newState.pendingRemoves = [];
  
  // Adicionar jogadores pendentes
  for (const pending of newState.pendingJoins) {
    if (newState.players.find(p => p.seat === pending.seat)) continue;
    if (newState.players.length >= 9) break;
    
    const id = `player_${pending.seat}_${Date.now() + pending.seat}`;
    const newPlayer: Player = {
      id, name: pending.name, seat: pending.seat,
      chips: newState.config.initialChips,
      holeCards: [], currentBet: 0, totalBetInHand: 0,
      isFolded: false, isAllIn: false, isConnected: true,
      isSittingOut: false, hasActed: false,
      isBot: pending.isBot, botDifficulty: pending.botDifficulty,
    };
    newState.players = [...newState.players, newPlayer].sort((a, b) => a.seat - b.seat);
  }
  newState.pendingJoins = [];
  
  return newState;
}

// Encontrar o próximo jogador ativo (circular) a partir de um índice no array
function findNextActivePlayer(players: Player[], fromIndex: number, skipAllIn = true): number {
  const len = players.length;
  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len;
    const p = players[idx];
    if (!p.isFolded && !p.isSittingOut && p.isConnected && p.chips > 0) {
      if (skipAllIn && p.isAllIn) continue;
      return idx;
    }
  }
  return -1;
}

// Encontrar o próximo jogador com fichas (para dealer etc.)
function findNextEligiblePlayer(players: Player[], fromIndex: number): number {
  const len = players.length;
  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len;
    const p = players[idx];
    if (p.chips > 0 && p.isConnected && !p.isSittingOut) {
      return idx;
    }
  }
  return -1;
}

// Iniciar uma nova mão
export function startNewHand(state: GameState): GameState {
  // Processar filas pendentes (adicionar/remover jogadores)
  state = processPendingQueues(state);
  
  // Remover jogadores sem fichas (eliminados)
  // Eles permanecem visíveis mas não jogam
  
  // Jogadores elegíveis (com fichas e conectados)
  const eligible = state.players.filter(p => p.chips > 0 && p.isConnected && !p.isSittingOut);
  
  if (eligible.length < 2) {
    return { ...state, phase: 'waiting' };
  }
  
  // Embaralhar baralho
  const deck = shuffleDeck(createDeck());
  
  // Avançar dealer
  let dealerIdx: number;
  if (state.dealerIndex < 0 || state.handNumber === 0) {
    // Primeiro dealer: primeiro jogador elegível
    dealerIdx = state.players.findIndex(p => p.chips > 0 && p.isConnected && !p.isSittingOut);
  } else {
    dealerIdx = findNextEligiblePlayer(state.players, state.dealerIndex);
  }
  
  if (dealerIdx < 0) return { ...state, phase: 'waiting' };
  
  // Calcular posições de blind
  let sbIdx: number, bbIdx: number;
  
  if (eligible.length === 2) {
    // Heads-up: dealer é SB, o outro é BB
    sbIdx = dealerIdx;
    bbIdx = findNextEligiblePlayer(state.players, dealerIdx);
  } else {
    sbIdx = findNextEligiblePlayer(state.players, dealerIdx);
    bbIdx = findNextEligiblePlayer(state.players, sbIdx);
  }
  
  if (sbIdx < 0 || bbIdx < 0) return { ...state, phase: 'waiting' };
  
  // Reset dos jogadores
  const resetPlayers: Player[] = state.players.map(p => ({
    ...p,
    holeCards: [],
    currentBet: 0,
    totalBetInHand: 0,
    isFolded: p.chips <= 0 || !p.isConnected || p.isSittingOut,
    isAllIn: false,
    hasActed: false,
    handResult: undefined,
    isWinner: false,
    winAmount: 0,
  }));
  
  // Distribuir cartas (2 para cada jogador ativo)
  let deckIndex = 0;
  const playersWithCards = resetPlayers.map(p => {
    if (p.isFolded || p.chips <= 0) return p;
    const card1 = deck[deckIndex++];
    const card2 = deck[deckIndex++];
    return { ...p, holeCards: [card1, card2] };
  });
  
  // Cobrar blinds
  const sbPlayer = playersWithCards[sbIdx];
  const bbPlayer = playersWithCards[bbIdx];
  
  const sbAmount = Math.min(state.config.smallBlind, sbPlayer.chips);
  const bbAmount = Math.min(state.config.bigBlind, bbPlayer.chips);
  
  playersWithCards[sbIdx] = {
    ...sbPlayer,
    chips: sbPlayer.chips - sbAmount,
    currentBet: sbAmount,
    totalBetInHand: sbAmount,
    isAllIn: sbPlayer.chips <= sbAmount,
    hasActed: false, // Blinds não contam como "agiu"
  };
  
  playersWithCards[bbIdx] = {
    ...bbPlayer,
    chips: bbPlayer.chips - bbAmount,
    currentBet: bbAmount,
    totalBetInHand: bbAmount,
    isAllIn: bbPlayer.chips <= bbAmount,
    hasActed: false,
  };
  
  // Primeiro a agir no pre-flop: depois do BB
  const firstToAct = findNextActivePlayer(playersWithCards, bbIdx);
  
  if (firstToAct < 0) {
    // Todos estão all-in após os blinds - ir direto ao showdown
    // Isso é raro mas possível
  }
  
  return {
    ...state,
    players: playersWithCards,
    deck,
    deckIndex,
    communityCards: [],
    revealedCards: [],
    pot: sbAmount + bbAmount,
    sidePots: [],
    dealerIndex: dealerIdx,
    smallBlindIndex: sbIdx,
    bigBlindIndex: bbIdx,
    currentPlayerIndex: firstToAct >= 0 ? firstToAct : -1,
    phase: 'preflop',
    currentBet: bbAmount,
    minRaise: bbAmount * 2, // Min raise no pre-flop = 2x BB
    lastRaiseSize: bbAmount,
    handNumber: state.handNumber + 1,
    winners: [],
    lastAction: undefined,
    turnStartTime: Date.now(),
  };
}

// Processar ação do jogador
export function processAction(state: GameState, playerId: string, action: PlayerAction): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return state;
  
  const player = state.players[playerIdx];
  
  // Verificar se é a vez deste jogador
  if (state.currentPlayerIndex !== playerIdx) return state;
  if (player.isFolded || player.isAllIn) return state;
  
  const newPlayers = state.players.map(p => ({ ...p }));
  let newPot = state.pot;
  let newCurrentBet = state.currentBet;
  let newMinRaise = state.minRaise;
  let newLastRaiseSize = state.lastRaiseSize;
  let lastAction: GameState['lastAction'] = undefined;
  
  switch (action.type) {
    case 'fold': {
      newPlayers[playerIdx].isFolded = true;
      newPlayers[playerIdx].hasActed = true;
      lastAction = { playerId, action: 'fold' };
      break;
    }
    
    case 'check': {
      // Só pode dar check se não há aposta pendente
      if (player.currentBet < state.currentBet) return state;
      newPlayers[playerIdx].hasActed = true;
      lastAction = { playerId, action: 'check' };
      break;
    }
    
    case 'call': {
      const callAmount = Math.min(state.currentBet - player.currentBet, player.chips);
      newPlayers[playerIdx].chips -= callAmount;
      newPlayers[playerIdx].currentBet += callAmount;
      newPlayers[playerIdx].totalBetInHand += callAmount;
      newPlayers[playerIdx].isAllIn = newPlayers[playerIdx].chips <= 0;
      newPlayers[playerIdx].hasActed = true;
      newPot += callAmount;
      lastAction = { playerId, action: 'call', amount: callAmount };
      break;
    }
    
    case 'raise': {
      // amount é o valor TOTAL da aposta (não o incremento)
      const targetBet = action.amount || state.minRaise;
      const additionalAmount = targetBet - player.currentBet;
      const actualAmount = Math.min(additionalAmount, player.chips);
      const actualTotalBet = player.currentBet + actualAmount;
      
      // Calcular o tamanho do raise
      const raiseSize = actualTotalBet - state.currentBet;
      
      newPlayers[playerIdx].chips -= actualAmount;
      newPlayers[playerIdx].currentBet = actualTotalBet;
      newPlayers[playerIdx].totalBetInHand += actualAmount;
      newPlayers[playerIdx].isAllIn = newPlayers[playerIdx].chips <= 0;
      newPlayers[playerIdx].hasActed = true;
      newPot += actualAmount;
      newCurrentBet = actualTotalBet;
      newLastRaiseSize = raiseSize;
      newMinRaise = actualTotalBet + Math.max(raiseSize, state.config.bigBlind);
      
      // Quando alguém faz raise, todos os outros precisam agir novamente
      newPlayers.forEach((p, i) => {
        if (i !== playerIdx && !p.isFolded && !p.isAllIn) {
          p.hasActed = false;
        }
      });
      
      lastAction = { playerId, action: 'raise', amount: actualTotalBet };
      break;
    }
    
    case 'allin': {
      const allInAmount = player.chips;
      const newTotalBet = player.currentBet + allInAmount;
      
      newPlayers[playerIdx].chips = 0;
      newPlayers[playerIdx].currentBet = newTotalBet;
      newPlayers[playerIdx].totalBetInHand += allInAmount;
      newPlayers[playerIdx].isAllIn = true;
      newPlayers[playerIdx].hasActed = true;
      newPot += allInAmount;
      
      if (newTotalBet > state.currentBet) {
        const raiseSize = newTotalBet - state.currentBet;
        newCurrentBet = newTotalBet;
        newLastRaiseSize = raiseSize;
        newMinRaise = newTotalBet + Math.max(raiseSize, state.config.bigBlind);
        
        // Quando alguém faz raise com all-in, outros precisam agir novamente
        newPlayers.forEach((p, i) => {
          if (i !== playerIdx && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        });
      }
      
      lastAction = { playerId, action: 'all-in', amount: allInAmount };
      break;
    }
  }
  
  let newState: GameState = {
    ...state,
    players: newPlayers,
    pot: newPot,
    currentBet: newCurrentBet,
    minRaise: newMinRaise,
    lastRaiseSize: newLastRaiseSize,
    lastAction,
  };
  
  // Verificar se a mão acabou (apenas 1 jogador restante)
  const nonFolded = newPlayers.filter(p => !p.isFolded);
  if (nonFolded.length === 1) {
    return resolveWinner(newState);
  }
  
  // Verificar se a rodada de apostas acabou
  if (isBettingRoundComplete(newState)) {
    return advancePhase(newState);
  }
  
  // Encontrar o próximo jogador a agir
  const nextIdx = findNextPlayerToAct(newState);
  if (nextIdx < 0) {
    return advancePhase(newState);
  }
  
  return {
    ...newState,
    currentPlayerIndex: nextIdx,
    turnStartTime: Date.now(),
  };
}

// Verificar se a rodada de apostas terminou
function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(p => !p.isFolded);
  
  // Todos os jogadores ativos já agiram ou estão all-in
  // E todos que não estão all-in têm a mesma aposta
  return activePlayers.every(p => {
    if (p.isAllIn) return true;
    return p.hasActed && p.currentBet === state.currentBet;
  });
}

// Encontrar o próximo jogador que precisa agir
function findNextPlayerToAct(state: GameState): number {
  const len = state.players.length;
  for (let i = 1; i <= len; i++) {
    const idx = (state.currentPlayerIndex + i) % len;
    const p = state.players[idx];
    if (!p.isFolded && !p.isAllIn && !p.hasActed && p.chips > 0) {
      return idx;
    }
  }
  return -1;
}

// Avançar para a próxima fase do jogo
function advancePhase(state: GameState): GameState {
  // Reset para nova rodada de apostas
  let newState: GameState = {
    ...state,
    players: state.players.map(p => ({
      ...p,
      currentBet: 0,
      hasActed: false,
    })),
    currentBet: 0,
    minRaise: state.config.bigBlind * 2,
    lastRaiseSize: state.config.bigBlind,
  };
  
  // Verificar quantos podem agir
  const canAct = newState.players.filter(p => !p.isFolded && !p.isAllIn);
  const nonFolded = newState.players.filter(p => !p.isFolded);
  const skipToEnd = canAct.length <= 1 && nonFolded.length > 1;
  
  switch (state.phase) {
    case 'preflop': {
      // Revelar Flop
      const flop = [state.deck[state.deckIndex], state.deck[state.deckIndex + 1], state.deck[state.deckIndex + 2]];
      newState = {
        ...newState,
        phase: 'flop',
        communityCards: flop,
        revealedCards: flop,
        deckIndex: state.deckIndex + 3,
      };
      if (skipToEnd) return advancePhase(newState);
      break;
    }
    case 'flop': {
      const turnCard = state.deck[state.deckIndex];
      newState = {
        ...newState,
        phase: 'turn',
        communityCards: [...state.communityCards, turnCard],
        revealedCards: [...state.communityCards, turnCard],
        deckIndex: state.deckIndex + 1,
      };
      if (skipToEnd) return advancePhase(newState);
      break;
    }
    case 'turn': {
      const riverCard = state.deck[state.deckIndex];
      newState = {
        ...newState,
        phase: 'river',
        communityCards: [...state.communityCards, riverCard],
        revealedCards: [...state.communityCards, riverCard],
        deckIndex: state.deckIndex + 1,
      };
      if (skipToEnd) return advancePhase(newState);
      break;
    }
    case 'river': {
      return resolveWinner(newState);
    }
    default:
      return resolveWinner(newState);
  }
  
  // Encontrar primeiro jogador a agir (após o dealer, excluindo all-in/fold)
  const firstToAct = findFirstToActPostFlop(newState);
  if (firstToAct < 0) {
    return advancePhase(newState);
  }
  
  return {
    ...newState,
    currentPlayerIndex: firstToAct,
    turnStartTime: Date.now(),
  };
}

// Primeiro jogador a agir pós-flop (primeiro ativo depois do dealer)
function findFirstToActPostFlop(state: GameState): number {
  const len = state.players.length;
  for (let i = 1; i <= len; i++) {
    const idx = (state.dealerIndex + i) % len;
    const p = state.players[idx];
    if (!p.isFolded && !p.isAllIn && p.chips > 0) {
      return idx;
    }
  }
  return -1;
}

// Calcular side pots
function calculateSidePots(players: Player[]): SidePot[] {
  const activePlayers = players.filter(p => !p.isFolded && p.totalBetInHand > 0);
  if (activePlayers.length === 0) return [];
  
  // Todos os níveis de aposta únicos, ordenados
  const betLevels = [...new Set(activePlayers.map(p => p.totalBetInHand))].sort((a, b) => a - b);
  
  const pots: SidePot[] = [];
  let prevLevel = 0;
  
  for (const level of betLevels) {
    const increment = level - prevLevel;
    if (increment <= 0) continue;
    
    // Quem contribui para este pote
    let potAmount = 0;
    const eligiblePlayerIds: string[] = [];
    
    for (const p of players) {
      const contribution = Math.min(p.totalBetInHand, level) - Math.min(p.totalBetInHand, prevLevel);
      potAmount += contribution;
    }
    
    // Jogadores elegíveis são os que apostaram pelo menos este nível E não foldaram
    for (const p of activePlayers) {
      if (p.totalBetInHand >= level) {
        eligiblePlayerIds.push(p.id);
      }
    }
    
    if (potAmount > 0 && eligiblePlayerIds.length > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds });
    }
    
    prevLevel = level;
  }
  
  return pots;
}

// Resolver o vencedor da mão
function resolveWinner(state: GameState): GameState {
  const nonFolded = state.players.filter(p => !p.isFolded);
  
  // Se apenas um jogador restante, ele ganha tudo
  if (nonFolded.length === 1) {
    const winner = nonFolded[0];
    const winnerIdx = state.players.findIndex(p => p.id === winner.id);
    const newPlayers = state.players.map(p => ({ ...p }));
    newPlayers[winnerIdx] = {
      ...winner,
      chips: winner.chips + state.pot,
      isWinner: true,
      winAmount: state.pot,
    };
    
    return {
      ...state,
      players: newPlayers,
      phase: 'showdown',
      winners: [{ playerId: winner.id, amount: state.pot, hand: 'Último restante' }],
      currentPlayerIndex: -1,
      showdownEndTime: Date.now() + 5000, // 5 segundos para próxima mão
    };
  }
  
  // Preencher cartas comunitárias se necessário
  let communityCards = [...state.communityCards];
  let deckIdx = state.deckIndex;
  while (communityCards.length < 5) {
    communityCards.push(state.deck[deckIdx++]);
  }
  
  // Avaliar mãos de todos os jogadores ativos
  const newPlayers = state.players.map(p => {
    if (p.isFolded) return { ...p };
    const handResult = evaluateBestHand(p.holeCards, communityCards);
    return { ...p, handResult };
  });
  
  // Calcular side pots
  const sidePots = calculateSidePots(newPlayers);
  
  // Se não há side pots mas há um pote, criar um pote principal
  const potsToResolve = sidePots.length > 0 ? sidePots : [{
    amount: state.pot,
    eligiblePlayerIds: nonFolded.map(p => p.id),
  }];
  
  // Distribuir cada pote
  const winners: { playerId: string; amount: number; hand: string }[] = [];
  
  for (const pot of potsToResolve) {
    const eligible = pot.eligiblePlayerIds
      .map(id => newPlayers.find(p => p.id === id)!)
      .filter(p => p && !p.isFolded && p.handResult);
    
    if (eligible.length === 0) continue;
    
    // Encontrar a melhor mão
    eligible.sort((a, b) => compareHands(b.handResult!, a.handResult!));
    const bestHand = eligible[0].handResult!;
    const potWinners = eligible.filter(p => compareHands(p.handResult!, bestHand) === 0);
    
    // Dividir o pote
    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount - share * potWinners.length;
    
    potWinners.forEach((winner, i) => {
      const idx = newPlayers.findIndex(p => p.id === winner.id);
      const extraChip = i === 0 ? remainder : 0;
      newPlayers[idx].chips += share + extraChip;
      newPlayers[idx].isWinner = true;
      newPlayers[idx].winAmount = (newPlayers[idx].winAmount || 0) + share + extraChip;
      
      winners.push({
        playerId: winner.id,
        amount: share + extraChip,
        hand: winner.handResult ? HAND_NAMES[winner.handResult.rank] : '',
      });
    });
  }
  
  return {
    ...state,
    players: newPlayers,
    communityCards,
    phase: 'showdown',
    winners,
    sidePots,
    currentPlayerIndex: -1,
    revealedCards: communityCards,
    showdownEndTime: Date.now() + 5000,
  };
}

// Obter informações da vez atual (para UI do jogador)
export function getCurrentTurnInfo(state: GameState): {
  playerId: string;
  callAmount: number;
  minRaise: number;
  canCheck: boolean;
  maxBet: number;
} | null {
  if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length) {
    return null;
  }
  
  const player = state.players[state.currentPlayerIndex];
  if (!player || player.isFolded || player.isAllIn) return null;
  
  const callAmount = state.currentBet - player.currentBet;
  const canCheck = callAmount === 0;
  const minRaise = state.minRaise;
  const maxBet = player.chips + player.currentBet;
  
  return {
    playerId: player.id,
    callAmount,
    minRaise,
    canCheck,
    maxBet,
  };
}

// Verificar tempo esgotado (fold automático)
export function checkTimeout(state: GameState): GameState {
  if (state.phase === 'waiting' || state.phase === 'showdown' || state.phase === 'handComplete') {
    return state;
  }
  
  if (state.currentPlayerIndex < 0) return state;
  
  const elapsed = (Date.now() - state.turnStartTime) / 1000;
  if (elapsed >= state.config.turnTimer) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer && !currentPlayer.isFolded && !currentPlayer.isAllIn) {
      return processAction(state, currentPlayer.id, { type: 'fold' });
    }
  }
  
  return state;
}

// Obter o nome da carta para exibição
export function getCardDisplay(card: Card): { rank: string; suit: string; suitSymbol: string; color: string } {
  const rankDisplay: Record<string, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
    '9': '9', 'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  };
  
  const suitDisplay: Record<string, { symbol: string; color: string }> = {
    'H': { symbol: '♥', color: 'red' },
    'D': { symbol: '♦', color: 'red' },
    'C': { symbol: '♣', color: 'black' },
    'S': { symbol: '♠', color: 'black' },
  };
  
  return {
    rank: rankDisplay[card.rank],
    suit: card.suit,
    suitSymbol: suitDisplay[card.suit].symbol,
    color: suitDisplay[card.suit].color,
  };
}
