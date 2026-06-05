// ================================================================
// POKER AIR — Game Store Online (Firebase)
// Tanto host quanto jogador leem/escrevem no Firebase
// O Firebase é a FONTE DA VERDADE — todos sincronizam dele
// ================================================================

import { ref, set, onValue, off, get } from 'firebase/database';
import { getFirebaseDatabase } from '../firebase/config';
import type { GameState, GameConfig, PlayerAction, BotDifficulty } from './gameLogic';
import {
  DEFAULT_CONFIG,
  createGameState, addPlayer, removePlayer, startNewHand, processAction,
  getCurrentTurnInfo, checkTimeout,
} from './gameLogic';
import { decideBotAction } from './botLogic';

export class OnlineGameStore {
  private state: GameState;
  private roomId: string;
  private isHost: boolean;
  private listeners: Set<(state: GameState) => void> = new Set();
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private botInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribeFirebase: (() => void) | null = null;
  private botDifficulty: BotDifficulty = 'medium';
  private writing = false; // Evitar loops de escrita

  constructor(roomId: string, isHost: boolean, config: GameConfig = DEFAULT_CONFIG) {
    this.roomId = roomId;
    this.isHost = isHost;
    this.state = createGameState(config);

    if (isHost) {
      // Escrever estado inicial no Firebase
      this.writeToFirebase(this.state);

      // Timer: timeout de jogadas + auto next hand + bots
      this.timerInterval = setInterval(() => {
        this.handleTimeout();
        this.handleAutoNextHand();
      }, 1000);

      // Processar bots
      this.botInterval = setInterval(() => {
        this.handleBotTurn();
      }, 1800);
    }

    // TODOS ouvem o Firebase — é a fonte da verdade
    this.listenToFirebase();
  }

  // =============================================
  // FIREBASE: Ler e Escrever
  // =============================================

  private getDbRef() {
    const db = getFirebaseDatabase();
    if (!db) return null;
    return ref(db, `rooms/${this.roomId}`);
  }

  private async writeToFirebase(state: GameState) {
    const dbRef = this.getDbRef();
    if (!dbRef) return;

    this.writing = true;
    try {
      await set(dbRef, {
        state: JSON.stringify(state),
        ts: Date.now(),
      });
    } catch (error) {
      console.error('❌ Firebase write error:', error);
    }
    // Pequeno delay antes de permitir leitura de volta
    setTimeout(() => { this.writing = false; }, 200);
  }

  private listenToFirebase() {
    const dbRef = this.getDbRef();
    if (!dbRef) return;

    const callback = onValue(dbRef, (snapshot) => {
      if (this.writing) return; // Ignorar eco da própria escrita
      
      const data = snapshot.val();
      if (data && data.state) {
        try {
          const newState = JSON.parse(data.state) as GameState;
          this.state = newState;
          this.notifyListeners();
        } catch (e) {
          console.error('❌ Firebase parse error:', e);
        }
      }
    });

    this.unsubscribeFirebase = () => off(dbRef, 'value', callback);
  }

  // Ler estado atual do Firebase (uma vez)
  private async readFromFirebase(): Promise<GameState | null> {
    const dbRef = this.getDbRef();
    if (!dbRef) return null;

    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return JSON.parse(data.state) as GameState;
      }
    } catch (e) {
      console.error('❌ Firebase read error:', e);
    }
    return null;
  }

  // =============================================
  // HOST: Timeout e Bots
  // =============================================

  private async handleTimeout() {
    if (!this.isHost) return;
    const phase = this.state.phase;
    if (phase === 'waiting' || phase === 'showdown' || phase === 'handComplete') return;
    if (this.state.currentPlayerIndex < 0) return;

    const newState = checkTimeout(this.state);
    if (newState !== this.state) {
      this.state = newState;
      this.notifyListeners();
      await this.writeToFirebase(newState);
    }
  }

  private async handleAutoNextHand() {
    if (!this.isHost) return;
    if (this.state.phase !== 'showdown') return;
    if (this.state.showdownEndTime <= 0) return;
    
    if (Date.now() >= this.state.showdownEndTime) {
      // Verificar se há jogadores suficientes para continuar
      const withChips = this.state.players.filter(p => p.chips > 0);
      if (withChips.length >= 2) {
        const newState = startNewHand(this.state);
        this.state = newState;
        this.notifyListeners();
        await this.writeToFirebase(newState);
      }
    }
  }

  private async handleBotTurn() {
    if (!this.isHost) return;
    const phase = this.state.phase;
    if (phase === 'waiting' || phase === 'showdown' || phase === 'handComplete') return;

    const idx = this.state.currentPlayerIndex;
    if (idx < 0 || idx >= this.state.players.length) return;

    const currentPlayer = this.state.players[idx];
    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.isFolded || currentPlayer.isAllIn) return;

    const action = decideBotAction(
      this.state,
      currentPlayer.id,
      currentPlayer.botDifficulty || this.botDifficulty
    );

    if (action) {
      const newState = processAction(this.state, currentPlayer.id, action);
      this.state = newState;
      this.notifyListeners();
      await this.writeToFirebase(newState);
    }
  }

  // =============================================
  // API PÚBLICA
  // =============================================

  setBotDifficulty(difficulty: BotDifficulty) {
    this.botDifficulty = difficulty;
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(fn => fn(this.state));
  }

  getState(): GameState {
    return this.state;
  }

  getRoomId(): string {
    return this.roomId;
  }

  getTurnInfo() {
    return getCurrentTurnInfo(this.state);
  }

  // =============================================
  // AÇÕES: Qualquer um pode chamar
  // Todas leem do Firebase → modificam → escrevem de volta
  // =============================================

  async hostAddPlayer(name: string, seat: number, isBot: boolean = false) {
    const current = await this.readFromFirebase() || this.state;
    const newState = addPlayer(current, name, seat, isBot, isBot ? this.botDifficulty : undefined);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  async hostRemovePlayer(playerId: string) {
    const current = await this.readFromFirebase() || this.state;
    const newState = removePlayer(current, playerId, false);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  // Jogador sai da mesa voluntariamente
  async playerLeave(playerId: string) {
    const current = await this.readFromFirebase() || this.state;
    const newState = removePlayer(current, playerId, true);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  async hostStartHand() {
    const current = await this.readFromFirebase() || this.state;
    const newState = startNewHand(current);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  async hostProcessAction(playerId: string, action: PlayerAction) {
    const current = await this.readFromFirebase() || this.state;
    const newState = processAction(current, playerId, action);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  // Jogador entrar: lê do Firebase, adiciona, escreve de volta
  async playerJoin(name: string, seat: number) {
    const current = await this.readFromFirebase();
    if (!current) {
      console.error('❌ Sala não encontrada no Firebase');
      return;
    }
    const newState = addPlayer(current, name, seat, false);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  // Jogador agir: lê do Firebase, processa, escreve de volta
  async playerAction(playerId: string, action: PlayerAction) {
    const current = await this.readFromFirebase();
    if (!current) return;
    const newState = processAction(current, playerId, action);
    this.state = newState;
    this.notifyListeners();
    await this.writeToFirebase(newState);
  }

  destroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.botInterval) clearInterval(this.botInterval);
    if (this.unsubscribeFirebase) this.unsubscribeFirebase();
    this.listeners.clear();
  }
}
