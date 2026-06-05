// ================================================================
// POKER AIR — Tela de Entrar na Sala
// Jogador escolhe assento → digita nome → joga
// Se veio pelo QR code com assento, pula direto para o nome
// ================================================================

import { useState, useEffect } from 'react';
import type { GameState, PlayerAction } from '../game/gameLogic';

interface IGameStore {
  subscribe: (listener: (state: GameState) => void) => () => void;
  getState: () => GameState;
  playerJoin: (name: string, seat: number) => void;
  playerAction: (playerId: string, action: PlayerAction) => void;
}

const SEAT_EMOJIS = ['🎯', '🎲', '🃏', '🎰', '🏆', '💎', '🔥', '⭐', '🎪'];

interface JoinRoomScreenProps {
  gameStore: IGameStore;
  roomId: string;
  initialSeat?: number; // Assento pré-selecionado (QR code)
  onJoined: (seat: number) => void;
  onBack: () => void;
}

type Step = 'seat' | 'name';

export default function JoinRoomScreen({ gameStore, roomId, initialSeat, onJoined, onBack }: JoinRoomScreenProps) {
  // Se veio com assento do QR code, pula direto para nome
  const hasPredefinedSeat = initialSeat !== undefined && initialSeat >= 0;
  
  const [step, setStep] = useState<Step>(hasPredefinedSeat ? 'name' : 'seat');
  const [gameState, setGameState] = useState<GameState>(gameStore.getState());
  const [selectedSeat, setSelectedSeat] = useState<number>(hasPredefinedSeat ? initialSeat : -1);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    const unsub = gameStore.subscribe((state) => setGameState(state));
    return unsub;
  }, [gameStore]);

  const occupiedSeats = gameState.players.map(p => p.seat);

  // Se assento pré-definido está ocupado, voltar pra seleção
  useEffect(() => {
    if (hasPredefinedSeat && occupiedSeats.includes(initialSeat)) {
      setStep('seat');
      setSelectedSeat(-1);
    }
  }, [hasPredefinedSeat, initialSeat, occupiedSeats]);

  const handleSelectSeat = (seat: number) => {
    setSelectedSeat(seat);
    setStep('name');
  };

  const handleJoin = () => {
    if (!playerName.trim() || selectedSeat < 0) return;
    gameStore.playerJoin(playerName.trim(), selectedSeat);
    onJoined(selectedSeat);
  };

  // ==========================================
  // ETAPA 1 — Escolher Assento
  // ==========================================
  if (step === 'seat') {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center p-6 overflow-y-auto">
        {/* Header */}
        <div className="w-full max-w-md flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">
            ← Voltar
          </button>
          <div className="bg-green-900/50 text-green-400 border border-green-700/30 px-3 py-1 rounded-full text-xs font-bold">
            🌐 Sala {roomId}
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl text-red-500">♥</span>
            <span className="text-2xl text-white">♠</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            POKER <span className="text-green-400">AIR</span>
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Escolha seu assento</p>
          <p className="text-gray-600 text-xs mt-1">
            {gameState.players.length} jogador(es) na mesa
          </p>
        </div>

        {/* Grid de assentos */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
          {Array.from({ length: 9 }, (_, i) => {
            const isOccupied = occupiedSeats.includes(i);
            const occupant = gameState.players.find(p => p.seat === i);

            return (
              <button
                key={i}
                onClick={() => !isOccupied && handleSelectSeat(i)}
                disabled={isOccupied}
                className={`rounded-2xl p-4 flex flex-col items-center justify-center min-h-[120px] transition-all duration-200 ${
                  isOccupied
                    ? 'bg-gray-800/30 border-2 border-gray-800 opacity-50 cursor-not-allowed'
                    : 'bg-gray-800/60 border-2 border-gray-600 hover:border-green-500 hover:bg-green-900/20 active:scale-95 cursor-pointer'
                }`}
              >
                {isOccupied ? (
                  <>
                    <span className="text-2xl mb-1">
                      {occupant?.isBot ? '🤖' : SEAT_EMOJIS[i]}
                    </span>
                    <span className="text-gray-500 text-xs font-bold truncate max-w-[80px]">
                      {occupant?.name || '---'}
                    </span>
                    <span className="text-red-400/60 text-[10px] mt-1">Ocupado</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl mb-1">{SEAT_EMOJIS[i]}</span>
                    <span className="text-gray-400 text-xs font-bold">Assento {i + 1}</span>
                    <span className="text-green-500 text-[10px] mt-1 font-bold">Disponível ✓</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-gray-600 text-xs text-center">
          Toque em um assento disponível para sentar
        </p>
      </div>
    );
  }

  // ==========================================
  // ETAPA 2 — Digitar Nome
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-2xl text-red-500">♥</span>
          <span className="text-2xl text-white">♠</span>
        </div>
        <h1 className="text-4xl font-black text-white mb-1">
          POKER <span className="text-green-400">AIR</span>
        </h1>

        <div className="flex items-center justify-center gap-3 mt-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-amber-500 flex items-center justify-center shadow-lg">
            <span className="text-xl">{SEAT_EMOJIS[selectedSeat]}</span>
          </div>
          <div className="text-left">
            <p className="text-white font-bold">Assento {selectedSeat + 1}</p>
            <p className="text-gray-500 text-xs">Sala {roomId}</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-xs">
        <label className="text-gray-500 text-xs uppercase tracking-wider mb-2 block text-center">
          Digite seu nome
        </label>
        <input
          type="text"
          placeholder="Ex: João"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          maxLength={12}
          className="w-full px-6 py-4 bg-gray-800/80 border-2 border-gray-600 rounded-2xl text-white text-xl text-center focus:outline-none focus:border-green-500 placeholder-gray-600 transition-all"
          autoFocus
        />
        
        <button
          onClick={handleJoin}
          disabled={!playerName.trim()}
          className={`w-full mt-4 py-4 text-xl font-black rounded-2xl transition-all duration-300 ${
            playerName.trim()
              ? 'bg-gradient-to-b from-green-500 to-green-700 text-white shadow-lg active:scale-95 border border-green-400/30'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
          }`}
        >
          ENTRAR NA MESA
        </button>

        <button
          onClick={() => { setStep('seat'); setSelectedSeat(-1); }}
          className="w-full mt-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          ← Trocar assento
        </button>
      </div>
    </div>
  );
}
