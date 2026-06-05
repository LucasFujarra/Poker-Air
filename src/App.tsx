// ================================================================
// POKER AIR — Aplicação Principal (Online apenas)
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import HomeScreen from './screens/HomeScreen';
import ModeSelectScreen from './screens/ModeSelectScreen';
import LobbyScreen from './screens/LobbyScreen';
import TableScreen from './screens/TableScreen';
import PlayerScreen from './screens/PlayerScreen';
import JoinRoomScreen from './screens/JoinRoomScreen';
import { OnlineGameStore } from './game/onlineGameStore';
import type { GameState, GameConfig, BotDifficulty, PlayerAction } from './game/gameLogic';
import { DEFAULT_CONFIG, createGameState } from './game/gameLogic';
import { initFirebase } from './firebase/config';
import { saveMyRoom } from './game/roomHistory';

type Screen = 'home' | 'mode' | 'lobby' | 'table' | 'player' | 'joinRoom';

interface IGameStore {
  subscribe: (listener: (state: GameState) => void) => () => void;
  getState: () => GameState;
  hostAddPlayer: (name: string, seat: number, isBot?: boolean) => void;
  hostRemovePlayer: (playerId: string) => void;
  hostStartHand: () => void;
  playerJoin: (name: string, seat: number) => void;
  playerAction: (playerId: string, action: PlayerAction) => void;
  playerLeave: (playerId: string) => void;
  destroy: () => void;
  setBotDifficulty?: (difficulty: BotDifficulty) => void;
}

// Detectar URL de jogador (QR code)
function parseHash(): { roomId: string; seat?: number } | null {
  const hash = window.location.hash;
  if (!hash) return null;

  // #/room/ABCDEF/player/0
  const full = hash.match(/#\/room\/([A-Za-z0-9]+)\/player\/(\d+)/);
  if (full) return { roomId: full[1].toUpperCase(), seat: parseInt(full[2]) };

  // #/room/ABCDEF
  const roomOnly = hash.match(/#\/room\/([A-Za-z0-9]+)$/);
  if (roomOnly) return { roomId: roomOnly[1].toUpperCase() };

  return null;
}

function App() {
  const hashInfo = useRef(parseHash());
  const isPlayerFromUrl = !!hashInfo.current;

  const [screen, setScreen] = useState<Screen>(isPlayerFromUrl ? 'joinRoom' : 'home');
  const [gameState, setGameState] = useState<GameState>(createGameState());
  const [playerSeat, setPlayerSeat] = useState<number>(hashInfo.current?.seat ?? -1);
  const [config] = useState<GameConfig>(DEFAULT_CONFIG);
  const [roomId, setRoomId] = useState<string>(hashInfo.current?.roomId || '');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const gameStoreRef = useRef<IGameStore | null>(null);
  const didInit = useRef(false);

  // Inicializar Firebase
  useEffect(() => { initFirebase(); }, []);

  // Jogador entrando via QR code / URL
  useEffect(() => {
    if (didInit.current || !hashInfo.current) return;
    didInit.current = true;

    const info = hashInfo.current;
    const store = new OnlineGameStore(info.roomId, false, config);
    gameStoreRef.current = store;
    store.subscribe((s) => setGameState(s));
    setRoomId(info.roomId);
    setPlayerSeat(info.seat ?? -1);
    setScreen('joinRoom');
  }, [config]);

  useEffect(() => () => { gameStoreRef.current?.destroy(); }, []);

  // ============ NAVEGAÇÃO ============

  const handlePlay = useCallback(() => setScreen('mode'), []);

  const handleBackToHome = useCallback(() => {
    gameStoreRef.current?.destroy();
    gameStoreRef.current = null;
    didInit.current = false;
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    setScreen('home');
  }, []);

  // ============ HOST: Criar / entrar sala ============

  const handleSelectOnlineHost = useCallback((room: string) => {
    gameStoreRef.current?.destroy();
    setRoomId(room);
    const store = new OnlineGameStore(room, true, config);
    store.setBotDifficulty?.(botDifficulty);
    gameStoreRef.current = store;
    store.subscribe((s) => setGameState(s));
    setScreen('lobby');
    saveMyRoom({ code: room, role: 'host', createdAt: Date.now(), lastAccess: Date.now() });
  }, [config, botDifficulty]);

  // ============ JOGADOR: Entrar na sala ============

  const handleSelectOnlineJoin = useCallback((room: string) => {
    gameStoreRef.current?.destroy();
    setRoomId(room);
    const store = new OnlineGameStore(room, false, config);
    gameStoreRef.current = store;
    store.subscribe((s) => setGameState(s));
    setPlayerSeat(-1);
    setScreen('joinRoom');
  }, [config]);

  const handlePlayerJoined = useCallback((seat: number) => {
    setPlayerSeat(seat);
    setScreen('player');
    if (roomId) {
      saveMyRoom({ code: roomId, role: 'player', seat, createdAt: Date.now(), lastAccess: Date.now() });
    }
  }, [roomId]);

  // ============ LOBBY / TABLE ============

  const handleAddBot = useCallback((name: string, seat: number) => {
    gameStoreRef.current?.hostAddPlayer(name, seat, true);
  }, []);

  const handleRemovePlayer = useCallback((playerId: string) => {
    gameStoreRef.current?.hostRemovePlayer(playerId);
  }, []);

  const handleSetBotDifficulty = useCallback((d: BotDifficulty) => {
    setBotDifficulty(d);
    gameStoreRef.current?.setBotDifficulty?.(d);
  }, []);

  const handleStartGame = useCallback(() => {
    gameStoreRef.current?.hostStartHand();
    setScreen('table');
  }, []);

  const handleNextHand = useCallback(() => {
    gameStoreRef.current?.hostStartHand();
  }, []);

  const handleBackToLobby = useCallback(() => setScreen('lobby'), []);

  const getBaseUrl = () => window.location.origin + window.location.pathname;

  // ============ RENDER ============

  switch (screen) {
    case 'home':
      return <HomeScreen onPlay={handlePlay} />;

    case 'mode':
      return (
        <ModeSelectScreen
          onSelectOnlineHost={handleSelectOnlineHost}
          onSelectOnlineJoin={handleSelectOnlineJoin}
        />
      );

    case 'lobby':
      return (
        <LobbyScreen
          gameState={gameState}
          onStartGame={handleStartGame}
          onAddBot={handleAddBot}
          onRemovePlayer={handleRemovePlayer}
          onSetBotDifficulty={handleSetBotDifficulty}
          botDifficulty={botDifficulty}
          baseUrl={getBaseUrl()}
          roomId={roomId}
          onBack={handleBackToHome}
        />
      );

    case 'table':
      return (
        <TableScreen
          gameState={gameState}
          onNextHand={handleNextHand}
          onBackToLobby={handleBackToLobby}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemovePlayer}
          botDifficulty={botDifficulty}
          baseUrl={getBaseUrl()}
          roomId={roomId}
        />
      );

    case 'joinRoom':
      if (!gameStoreRef.current) {
        return (
          <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
            <div className="text-5xl mb-4 animate-bounce">🎴</div>
            <div className="text-gray-400 text-lg">Conectando à sala...</div>
            {roomId && <div className="text-green-400 font-mono text-2xl mt-2">{roomId}</div>}
          </div>
        );
      }
      return (
        <JoinRoomScreen
          gameStore={gameStoreRef.current}
          roomId={roomId}
          initialSeat={playerSeat >= 0 ? playerSeat : undefined}
          onJoined={handlePlayerJoined}
          onBack={handleBackToHome}
        />
      );

    case 'player':
      if (!gameStoreRef.current) {
        return (
          <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center">
            <div className="text-5xl mb-4 animate-bounce">🎴</div>
            <div className="text-gray-400">Conectando...</div>
          </div>
        );
      }
      return (
        <PlayerScreen
          seat={playerSeat}
          gameStore={gameStoreRef.current}
          onLeave={handleBackToHome}
        />
      );

    default:
      return <HomeScreen onPlay={handlePlay} />;
  }
}

export default App;
