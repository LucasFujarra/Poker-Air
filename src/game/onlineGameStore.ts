// ================================================================
// POKER AIR — Game Store Online (Firebase)
// Anfitrião publica o estado; jogadores enviam pedidos autenticados
// O Firebase é a FONTE DA VERDADE — todos sincronizam dele
// ================================================================

import { ref, child, set, onValue, off, get, update, push, remove, runTransaction, onChildAdded } from 'firebase/database';
import { getFirebaseDatabase, ensureFirebaseUser } from '../firebase/config';
import type { GameState, GameConfig, PlayerAction, BotDifficulty } from './gameLogic';
import {
  DEFAULT_CONFIG,
  createGameState, addPlayer, removePlayer, startNewHand, processAction,
  getCurrentTurnInfo, checkTimeout,
} from './gameLogic';
import { decideBotAction } from './botLogic';
import { applyRoomRequest } from './roomRequests';

export class OnlineGameStore {
  private state: GameState;
  private roomId: string;
  private isHost: boolean;
  private listeners: Set<(state: GameState) => void> = new Set();
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private botInterval: ReturnType<typeof setInterval> | null = null;
  private unsubscribeFirebase: (() => void) | null = null;
  private botDifficulty: BotDifficulty = 'medium';
  private ready: Promise<void>;
  private uid = '';
  private destroyed = false;
  private unsubscribeRequests: (() => void) | null = null;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(roomId: string, isHost: boolean, config: GameConfig = DEFAULT_CONFIG) {
    this.roomId = roomId;
    this.isHost = isHost;
    this.state = createGameState(config);

    // TODOS ouvem o Firebase — é a fonte da verdade
    this.ready = this.connect().catch((error) => {
      console.error('❌ Não foi possível acessar a sala:', error);
      this.destroy();
      window.alert('Não foi possível acessar esta sala. Confira o código, as permissões e a conexão.');
      throw error;
    });
    void this.ready.catch(() => {});
  }

  private async connect() {
    this.uid = await ensureFirebaseUser();
    const dbRef = this.getDbRef();
    if (!dbRef || this.destroyed) return;
    if (this.isHost) {
      const snapshot = await get(dbRef);
      if (!snapshot.exists()) {
        await update(dbRef, { hostUid: this.uid, createdAt: Date.now(), state: JSON.stringify(this.state), ts: Date.now() });
      } else {
        if (snapshot.val().hostUid !== this.uid) throw new Error('Esta sala pertence a outro anfitrião.');
        this.state = JSON.parse(snapshot.val().state);
      }
      await this.writeToFirebase(this.state);
    } else {
      await set(child(dbRef, `members/${this.uid}`), true);
    }
    if (this.destroyed) return;
    this.listenToFirebase();
    if (this.isHost) {
      this.listenToRequests();
      this.timerInterval = setInterval(() => {
        void this.handleTimeout().catch(console.error);
        void this.handleAutoNextHand().catch(console.error);
      }, 1000);
      this.botInterval = setInterval(() => { void this.handleBotTurn().catch(console.error); }, 1800);
    }
  }

  private listenToRequests() {
    const dbRef = this.getDbRef();
    if (!dbRef) return;
    this.unsubscribeRequests = onChildAdded(child(dbRef, 'requests'), (snapshot) => {
      this.requestQueue = this.requestQueue.then(async () => {
        if (this.destroyed) return;
        const request = snapshot.val();
        const uid = snapshot.key!;
        const current = this.state;
        const next = applyRoomRequest(current, uid, request);
        if (next !== current) {
          await this.writeToFirebase(next);
          this.state = next;
          this.notifyListeners();
        }
        await runTransaction(snapshot.ref, current => current?.id === request.id ? null : undefined);
      }).catch(error => console.error('Erro ao processar pedido:', error));
    });
  }

  private async sendRequest(request: Record<string, unknown>) {
    await this.ready;
    const dbRef = this.getDbRef();
    if (!dbRef || this.destroyed) return;
    // Um pedido por dispositivo; o anfitrião o remove após processar.
    const requestRef = child(dbRef, `requests/${this.uid}`);
    await set(requestRef, { ...request, id: push(requestRef).key });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        void remove(requestRef).catch(console.error);
        reject(new Error('O anfitrião não respondeu. Confira se a mesa está aberta.'));
      }, 15000);
      const unsubscribe = onValue(requestRef, snapshot => {
        if (snapshot.exists()) return;
        clearTimeout(timer);
        queueMicrotask(() => { unsubscribe(); resolve(); });
      }, error => { clearTimeout(timer); queueMicrotask(() => { unsubscribe(); reject(error); }); });
    });
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
    if (!dbRef || !this.isHost || this.destroyed) return;

    try {
      await update(dbRef, {
        state: JSON.stringify(state),
        ts: Date.now(),
      });
      await set(child(dbRef.root, `roomDirectory/${this.uid}/${this.roomId}`), {
        code: this.roomId, updatedAt: Date.now(),
        playerCount: state.players.filter(p => !p.isBot).length, phase: state.phase,
      });
    } catch (error) {
      console.error('❌ Firebase write error:', error);
      throw error;
    }
  }

  private listenToFirebase() {
    const dbRef = this.getDbRef();
    if (!dbRef) return;

    const stateRef = child(dbRef, 'state');
    const callback = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        try {
          const newState = JSON.parse(data) as GameState;
          this.state = newState;
          this.notifyListeners();
        } catch (e) {
          console.error('❌ Firebase parse error:', e);
        }
      }
    });

    this.unsubscribeFirebase = () => off(stateRef, 'value', callback);
  }

  private async mutate(transform: (state: GameState) => GameState) {
    if (!this.isHost) return;
    await this.ready;
    const operation = this.requestQueue.then(async () => {
      if (this.destroyed) return;
      const next = transform(this.state);
      if (next === this.state) return;
      await this.writeToFirebase(next);
      this.state = next;
      this.notifyListeners();
    });
    this.requestQueue = operation.catch(error => console.error('Erro ao atualizar partida:', error));
    await operation;
  }

  private async handleTimeout() {
    await this.mutate(checkTimeout);
  }

  private async handleAutoNextHand() {
    await this.mutate(state => state.phase === 'showdown' && state.showdownEndTime > 0 &&
      Date.now() >= state.showdownEndTime && state.players.filter(p => p.chips > 0).length >= 2
      ? startNewHand(state) : state);
  }

  private async handleBotTurn() {
    await this.mutate(state => {
      if (['waiting', 'showdown', 'handComplete'].includes(state.phase)) return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player?.isBot || player.isFolded || player.isAllIn) return state;
      const action = decideBotAction(state, player.id, player.botDifficulty || this.botDifficulty);
      return action ? processAction(state, player.id, action) : state;
    });
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

  async updateConfig(config: GameConfig) {
    await this.mutate(current => current.phase !== 'waiting' ? current : ({
      ...current, config, minRaise: config.bigBlind, lastRaiseSize: config.bigBlind,
      players: current.players.map(player => ({ ...player, chips: config.initialChips })),
    }));
  }

  async hostAddPlayer(name: string, seat: number, isBot: boolean = false) {
    await this.mutate(current => addPlayer(current, name, seat, isBot, isBot ? this.botDifficulty : undefined));
  }

  async hostRemovePlayer(playerId: string) {
    await this.mutate(current => removePlayer(current, playerId, false));
  }

  async playerLeave(playerId: string) {
    await this.sendRequest({ type: 'leave', playerId });
  }

  async hostStartHand() {
    await this.mutate(startNewHand);
  }

  async hostProcessAction(playerId: string, action: PlayerAction) {
    await this.mutate(current => processAction(current, playerId, action));
  }

  async playerJoin(name: string, seat: number, _sessionId?: string) {
    await this.sendRequest({ type: 'join', name, seat });
    const joined = [...this.state.players, ...this.state.pendingJoins].some(p => p.sessionId === this.uid && p.seat === seat);
    if (!joined) throw new Error('Assento indisponível. Escolha outro assento.');
  }

  async playerAction(playerId: string, action: PlayerAction) {
    await this.sendRequest({ type: 'action', playerId, action: { type: action.type, ...(action.amount === undefined ? {} : { amount: action.amount }) } });
  }

  destroy() {
    this.destroyed = true;
    this.unsubscribeRequests?.();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.botInterval) clearInterval(this.botInterval);
    if (this.unsubscribeFirebase) this.unsubscribeFirebase();
    this.listeners.clear();
  }
}
