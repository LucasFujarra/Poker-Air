// ================================================================
// POKER AIR — Lógica dos Bots
// Bots automáticos com diferentes níveis de dificuldade
// ================================================================

import type { GameState, PlayerAction } from './gameLogic';
import { getCurrentTurnInfo } from './gameLogic';
import type { Card } from './handEvaluator';
import { evaluateBestHand, HandRank } from './handEvaluator';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

// Avaliar força da mão inicial (hole cards)
function evaluateHoleCards(cards: Card[]): number {
  if (cards.length !== 2) return 0;
  
  const [c1, c2] = cards;
  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  
  const v1 = rankValues[c1.rank];
  const v2 = rankValues[c2.rank];
  const highCard = Math.max(v1, v2);
  const lowCard = Math.min(v1, v2);
  const isPair = v1 === v2;
  const isSuited = c1.suit === c2.suit;
  const gap = highCard - lowCard;
  const isConnected = gap === 1;
  
  let score = 0;
  
  // Par
  if (isPair) {
    score = 50 + highCard * 3;
    if (highCard >= 10) score += 20; // Par alto
    if (highCard === 14) score += 30; // Par de Ases
  } else {
    // Cartas altas
    score = highCard + lowCard / 2;
    
    // Suited
    if (isSuited) score += 10;
    
    // Conectores
    if (isConnected) score += 8;
    if (gap === 2) score += 4;
    
    // Premium hands
    if (highCard === 14 && lowCard >= 10) score += 25; // AK, AQ, AJ, AT
    if (highCard === 13 && lowCard >= 10) score += 15; // KQ, KJ, KT
    
    // Face cards
    if (highCard >= 11 && lowCard >= 11) score += 12;
  }
  
  return Math.min(100, score);
}

// Avaliar força da mão atual (com cartas comunitárias)
function evaluateCurrentHand(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) {
    return evaluateHoleCards(holeCards);
  }
  
  const handResult = evaluateBestHand(holeCards, communityCards);
  
  // Pontuação baseada no ranking da mão
  const rankScores: Record<HandRank, number> = {
    [HandRank.HIGH_CARD]: 15,
    [HandRank.ONE_PAIR]: 35,
    [HandRank.TWO_PAIR]: 55,
    [HandRank.THREE_OF_A_KIND]: 70,
    [HandRank.STRAIGHT]: 80,
    [HandRank.FLUSH]: 85,
    [HandRank.FULL_HOUSE]: 92,
    [HandRank.FOUR_OF_A_KIND]: 97,
    [HandRank.STRAIGHT_FLUSH]: 99,
    [HandRank.ROYAL_FLUSH]: 100,
  };
  
  return rankScores[handResult.rank] || 0;
}

// Decisão do Bot FÁCIL - joga de forma previsível e comete erros
function decideBotEasy(
  state: GameState,
  playerId: string,
  turnInfo: NonNullable<ReturnType<typeof getCurrentTurnInfo>>
): PlayerAction {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { type: 'fold' };
  
  const random = Math.random() * 100;
  const handStrength = evaluateCurrentHand(player.holeCards, state.communityCards);
  
  // Bot fácil: joga muito passivo, faz call demais
  if (turnInfo.canCheck) {
    // 80% check, 20% raise pequeno
    if (random < 80) return { type: 'check' };
    return { type: 'raise', amount: turnInfo.minRaise };
  }
  
  // Se precisa pagar
  const potOdds = turnInfo.callAmount / (state.pot + turnInfo.callAmount);
  
  if (handStrength > 60) {
    // Mão boa: 70% call, 30% raise
    if (random < 70) return { type: 'call' };
    return { type: 'raise', amount: turnInfo.minRaise };
  } else if (handStrength > 30) {
    // Mão média: 60% call, 40% fold
    if (random < 60) return { type: 'call' };
    return { type: 'fold' };
  } else {
    // Mão ruim: 30% call (erro), 70% fold
    if (random < 30 && potOdds < 0.3) return { type: 'call' };
    return { type: 'fold' };
  }
}

// Decisão do Bot MÉDIO - joga razoavelmente
function decideBotMedium(
  state: GameState,
  playerId: string,
  turnInfo: NonNullable<ReturnType<typeof getCurrentTurnInfo>>
): PlayerAction {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { type: 'fold' };
  
  const random = Math.random() * 100;
  const handStrength = evaluateCurrentHand(player.holeCards, state.communityCards);
  const potOdds = turnInfo.callAmount / (state.pot + turnInfo.callAmount);
  const isPreflop = state.communityCards.length === 0;
  
  if (turnInfo.canCheck) {
    if (handStrength > 70) {
      // Mão forte: 40% check (slow play), 60% raise
      if (random < 40) return { type: 'check' };
      const raiseAmount = Math.min(
        turnInfo.minRaise + Math.floor(state.pot * 0.5),
        player.chips + player.currentBet
      );
      return { type: 'raise', amount: raiseAmount };
    } else if (handStrength > 40) {
      // Mão média: 70% check, 30% raise
      if (random < 70) return { type: 'check' };
      return { type: 'raise', amount: turnInfo.minRaise };
    }
    return { type: 'check' };
  }
  
  // Precisa pagar
  if (handStrength > 75) {
    // Mão muito forte: raise ou reraise
    if (random < 60) {
      const raiseAmount = Math.min(
        turnInfo.minRaise + Math.floor(state.pot * 0.75),
        player.chips + player.currentBet
      );
      return { type: 'raise', amount: raiseAmount };
    }
    return { type: 'call' };
  } else if (handStrength > 50) {
    // Mão boa: call ou raise pequeno
    if (random < 75) return { type: 'call' };
    return { type: 'raise', amount: turnInfo.minRaise };
  } else if (handStrength > 30) {
    // Mão mediana: call se pot odds boas
    if (potOdds < 0.25 || (isPreflop && handStrength > 35)) {
      return { type: 'call' };
    }
    return { type: 'fold' };
  } else {
    // Mão fraca
    if (isPreflop && potOdds < 0.15 && random < 20) {
      return { type: 'call' }; // Às vezes defende o blind
    }
    return { type: 'fold' };
  }
}

// Decisão do Bot DIFÍCIL - joga estrategicamente
function decideBotHard(
  state: GameState,
  playerId: string,
  turnInfo: NonNullable<ReturnType<typeof getCurrentTurnInfo>>
): PlayerAction {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { type: 'fold' };
  
  const random = Math.random() * 100;
  const handStrength = evaluateCurrentHand(player.holeCards, state.communityCards);
  const potOdds = turnInfo.callAmount / (state.pot + turnInfo.callAmount);
  const isPreflop = state.communityCards.length === 0;
  
  // Calcular posição (quanto maior, melhor)
  const activePlayers = state.players.filter(p => !p.isFolded);
  const myPosition = activePlayers.findIndex(p => p.id === playerId);
  const positionStrength = myPosition / Math.max(1, activePlayers.length - 1);
  const isLatePosition = positionStrength > 0.6;
  
  // Ajustar força da mão baseado na posição
  let adjustedStrength = handStrength;
  if (isLatePosition) adjustedStrength += 10;
  if (isPreflop && positionStrength < 0.3) adjustedStrength -= 10;
  
  // Stack size consideration
  const stackToPot = player.chips / Math.max(1, state.pot);
  const isShortStack = stackToPot < 10;
  
  if (turnInfo.canCheck) {
    if (adjustedStrength > 80) {
      // Monster hand: mix de check (trap) e bet
      if (random < 35) return { type: 'check' };
      const raiseAmount = Math.min(
        Math.floor(state.pot * (0.6 + Math.random() * 0.4)),
        player.chips + player.currentBet
      );
      return { type: 'raise', amount: Math.max(turnInfo.minRaise, raiseAmount) };
    } else if (adjustedStrength > 55) {
      // Mão boa: value bet
      if (random < 60) {
        const raiseAmount = Math.min(
          Math.floor(state.pot * (0.5 + Math.random() * 0.25)),
          player.chips + player.currentBet
        );
        return { type: 'raise', amount: Math.max(turnInfo.minRaise, raiseAmount) };
      }
      return { type: 'check' };
    } else if (adjustedStrength > 35 && isLatePosition) {
      // Blefe em posição
      if (random < 25) {
        return { type: 'raise', amount: turnInfo.minRaise };
      }
    }
    return { type: 'check' };
  }
  
  // Facing a bet
  const impliedOdds = adjustedStrength / 100;
  const shouldCall = impliedOdds > potOdds * 1.2;
  
  if (adjustedStrength > 85) {
    // Mão monstruosa: raise ou all-in
    if (isShortStack && random < 50) {
      return { type: 'allin' };
    }
    const raiseAmount = Math.min(
      Math.floor(state.pot * (0.8 + Math.random() * 0.7)),
      player.chips + player.currentBet
    );
    return { type: 'raise', amount: Math.max(turnInfo.minRaise, raiseAmount) };
  } else if (adjustedStrength > 65) {
    // Mão forte
    if (random < 40) {
      return { type: 'raise', amount: turnInfo.minRaise };
    }
    return { type: 'call' };
  } else if (adjustedStrength > 45) {
    // Mão decente
    if (shouldCall) return { type: 'call' };
    // Blefe ocasional
    if (random < 15 && isLatePosition) {
      return { type: 'raise', amount: turnInfo.minRaise };
    }
    return { type: 'fold' };
  } else if (adjustedStrength > 25) {
    // Mão fraca
    if (potOdds < 0.15 && random < 30) return { type: 'call' };
    // Blefe raro
    if (random < 8 && isLatePosition && state.communityCards.length >= 3) {
      return { type: 'raise', amount: Math.floor(state.pot * 0.75) };
    }
    return { type: 'fold' };
  }
  
  // Mão muito fraca
  return { type: 'fold' };
}

// Função principal: decidir ação do bot
export function decideBotAction(
  state: GameState,
  playerId: string,
  difficulty: BotDifficulty
): PlayerAction | null {
  const turnInfo = getCurrentTurnInfo(state);
  if (!turnInfo || turnInfo.playerId !== playerId) {
    return null;
  }
  
  // Adicionar delay aleatório simulando "pensamento"
  switch (difficulty) {
    case 'easy':
      return decideBotEasy(state, playerId, turnInfo);
    case 'medium':
      return decideBotMedium(state, playerId, turnInfo);
    case 'hard':
      return decideBotHard(state, playerId, turnInfo);
    default:
      return decideBotMedium(state, playerId, turnInfo);
  }
}
