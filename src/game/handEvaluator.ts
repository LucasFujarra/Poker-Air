// ================================================================
// POKER AIR — Avaliador de Mãos de Poker
// Implementação completa de avaliação de mãos Texas Hold'em
// ================================================================

// Naipes e valores das cartas
export type Suit = 'H' | 'D' | 'C' | 'S'; // Hearts, Diamonds, Clubs, Spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  code: string; // ex: "AH" = Ás de Copas
}

// Classificação das mãos (maior = melhor)
export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: 'Carta Alta',
  [HandRank.ONE_PAIR]: 'Par',
  [HandRank.TWO_PAIR]: 'Dois Pares',
  [HandRank.THREE_OF_A_KIND]: 'Trinca',
  [HandRank.STRAIGHT]: 'Sequência',
  [HandRank.FLUSH]: 'Flush',
  [HandRank.FULL_HOUSE]: 'Full House',
  [HandRank.FOUR_OF_A_KIND]: 'Quadra',
  [HandRank.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandRank.ROYAL_FLUSH]: 'Royal Flush',
};

export interface HandResult {
  rank: HandRank;
  name: string;
  values: number[]; // Valores para desempate (do mais importante ao menos)
  cards: Card[]; // As 5 cartas que formam a mão
}

// Valor numérico de cada carta
const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// Criar uma carta a partir do código (ex: "AH")
export function createCard(code: string): Card {
  const rank = code[0] as Rank;
  const suit = code[1] as Suit;
  return { rank, suit, code };
}

// Criar o baralho completo (52 cartas)
export function createDeck(): Card[] {
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suits: Suit[] = ['H', 'D', 'C', 'S'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  return deck;
}

// Embaralhar o baralho (Fisher-Yates)
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Obter valor numérico da carta
function getValue(card: Card): number {
  return RANK_VALUES[card.rank];
}

// Gerar todas as combinações de 5 cartas a partir de 7
function combinations(cards: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  function combine(start: number, combo: Card[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      combo.push(cards[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

// Avaliar uma mão de 5 cartas
function evaluate5Cards(cards: Card[]): HandResult {
  const sorted = [...cards].sort((a, b) => getValue(b) - getValue(a));
  const values = sorted.map(getValue);
  
  // Verificar flush (todas do mesmo naipe)
  const isFlush = sorted.every(c => c.suit === sorted[0].suit);
  
  // Verificar sequência
  let isStraight = false;
  let straightHighValue = 0;
  
  // Sequência normal
  if (values[0] - values[4] === 4 && new Set(values).size === 5) {
    isStraight = true;
    straightHighValue = values[0];
  }
  // Sequência com Ás baixo (A-2-3-4-5)
  if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    isStraight = true;
    straightHighValue = 5; // A carta mais alta é o 5 nesta sequência
  }
  
  // Contar ocorrências de cada valor
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  
  const countEntries = Object.entries(counts)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  
  // Royal Flush
  if (isFlush && isStraight && straightHighValue === 14) {
    return { rank: HandRank.ROYAL_FLUSH, name: HAND_NAMES[HandRank.ROYAL_FLUSH], values: [14], cards: sorted };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: HandRank.STRAIGHT_FLUSH, name: HAND_NAMES[HandRank.STRAIGHT_FLUSH], values: [straightHighValue], cards: sorted };
  }
  
  // Quadra
  if (countEntries[0].count === 4) {
    const quadValue = countEntries[0].value;
    const kicker = countEntries[1].value;
    return { rank: HandRank.FOUR_OF_A_KIND, name: HAND_NAMES[HandRank.FOUR_OF_A_KIND], values: [quadValue, kicker], cards: sorted };
  }
  
  // Full House
  if (countEntries[0].count === 3 && countEntries[1].count === 2) {
    return { rank: HandRank.FULL_HOUSE, name: HAND_NAMES[HandRank.FULL_HOUSE], values: [countEntries[0].value, countEntries[1].value], cards: sorted };
  }
  
  // Flush
  if (isFlush) {
    return { rank: HandRank.FLUSH, name: HAND_NAMES[HandRank.FLUSH], values, cards: sorted };
  }
  
  // Sequência
  if (isStraight) {
    return { rank: HandRank.STRAIGHT, name: HAND_NAMES[HandRank.STRAIGHT], values: [straightHighValue], cards: sorted };
  }
  
  // Trinca
  if (countEntries[0].count === 3) {
    const triValue = countEntries[0].value;
    const kickers = countEntries.filter(e => e.count !== 3).map(e => e.value).sort((a, b) => b - a);
    return { rank: HandRank.THREE_OF_A_KIND, name: HAND_NAMES[HandRank.THREE_OF_A_KIND], values: [triValue, ...kickers], cards: sorted };
  }
  
  // Dois Pares
  if (countEntries[0].count === 2 && countEntries[1].count === 2) {
    const pairs = [countEntries[0].value, countEntries[1].value].sort((a, b) => b - a);
    const kicker = countEntries[2].value;
    return { rank: HandRank.TWO_PAIR, name: HAND_NAMES[HandRank.TWO_PAIR], values: [...pairs, kicker], cards: sorted };
  }
  
  // Par
  if (countEntries[0].count === 2) {
    const pairValue = countEntries[0].value;
    const kickers = countEntries.filter(e => e.count !== 2).map(e => e.value).sort((a, b) => b - a);
    return { rank: HandRank.ONE_PAIR, name: HAND_NAMES[HandRank.ONE_PAIR], values: [pairValue, ...kickers], cards: sorted };
  }
  
  // Carta Alta
  return { rank: HandRank.HIGH_CARD, name: HAND_NAMES[HandRank.HIGH_CARD], values, cards: sorted };
}

// Avaliar a melhor mão possível de 7 cartas (2 do jogador + 5 comunitárias)
export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const allCombinations = combinations(allCards, 5);
  
  let bestHand: HandResult | null = null;
  
  for (const combo of allCombinations) {
    const result = evaluate5Cards(combo);
    if (!bestHand || compareHands(result, bestHand) > 0) {
      bestHand = result;
    }
  }
  
  return bestHand!;
}

// Comparar duas mãos: retorna positivo se hand1 > hand2, negativo se menor, 0 se empate
export function compareHands(hand1: HandResult, hand2: HandResult): number {
  // Primeiro comparar o ranking da mão
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }
  
  // Se mesmo ranking, comparar os valores de desempate
  for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
    if (hand1.values[i] !== hand2.values[i]) {
      return hand1.values[i] - hand2.values[i];
    }
  }
  
  return 0; // Empate total
}
