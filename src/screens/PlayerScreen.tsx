// ================================================================
// POKER AIR — Tela do Jogador (Celular)
// Layout compacto: tudo visível sem scroll
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, PlayerAction } from '../game/gameLogic';
import { getCurrentTurnInfo, getCardDisplay } from '../game/gameLogic';
import type { Card } from '../game/handEvaluator';

interface IGameStore {
  subscribe: (listener: (state: GameState) => void) => () => void;
  getState: () => GameState;
  playerJoin: (name: string, seat: number) => void;
  playerAction: (playerId: string, action: PlayerAction) => void;
  playerLeave: (playerId: string) => void;
}

interface PlayerScreenProps {
  seat: number;
  gameStore: IGameStore;
  onLeave: () => void;
}

function MobileCard({ card, index }: { card: Card; index: number }) {
  const d = getCardDisplay(card);
  const red = d.color === 'red';
  return (
    <div className="relative w-[105px] h-[148px] bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center overflow-hidden animate-card-flip" style={{ animationDelay: `${index * 200}ms` }}>
      <div className={`absolute inset-0 rounded-2xl border-[3px] ${red ? 'border-red-100' : 'border-gray-100'}`} />
      <div className="absolute top-2 left-2 flex flex-col items-center">
        <span className={`text-base font-black leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}>{d.rank}</span>
        <span className={`text-base leading-none ${red ? 'text-red-500' : 'text-gray-700'}`}>{d.suitSymbol}</span>
      </div>
      <span className={`text-6xl ${red ? 'text-red-500' : 'text-gray-800'}`}>{d.suitSymbol}</span>
      <div className="absolute bottom-2 right-2 flex flex-col items-center rotate-180">
        <span className={`text-base font-black leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}>{d.rank}</span>
        <span className={`text-base leading-none ${red ? 'text-red-500' : 'text-gray-700'}`}>{d.suitSymbol}</span>
      </div>
    </div>
  );
}

function SmallCard({ card }: { card: Card }) {
  const d = getCardDisplay(card);
  const red = d.color === 'red';
  return (
    <div className={`w-10 h-14 bg-white rounded-md border shadow flex flex-col items-center justify-center ${red ? 'border-red-200' : 'border-gray-300'}`}>
      <span className={`text-xs font-black leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}>{d.rank}</span>
      <span className={`text-sm leading-none ${red ? 'text-red-600' : 'text-gray-900'}`}>{d.suitSymbol}</span>
    </div>
  );
}

function LeaveModal({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl p-6 max-w-xs w-full border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🚪</div>
          <h3 className="text-white font-bold text-lg">Sair da mesa?</h3>
          <p className="text-gray-400 text-sm mt-2">Você sairá da partida.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-xl">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl">Sair</button>
        </div>
      </div>
    </div>
  );
}

export default function PlayerScreen({ seat, gameStore, onLeave }: PlayerScreenProps) {
  const [gameState, setGameState] = useState<GameState>(gameStore.getState());
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  useEffect(() => { return gameStore.subscribe((s) => setGameState(s)); }, [gameStore]);

  const player = gameState.players.find(p => p.seat === seat);
  const playerId = player?.id || '';
  const isPending = !player && gameState.pendingJoins?.some(p => p.seat === seat);

  useEffect(() => {
    if (player?.isConnected) { setIsJoined(true); if (!playerName) setPlayerName(player.name); }
  }, [player, playerName]);

  const turnInfo = getCurrentTurnInfo(gameState);
  const isMyTurn = turnInfo?.playerId === playerId;
  const currentTurnPlayer = gameState.currentPlayerIndex >= 0 ? gameState.players[gameState.currentPlayerIndex] : null;
  const [timeLeft, setTimeLeft] = useState(30);
  const [showdownCountdown, setShowdownCountdown] = useState(10);

  // Só setar raiseAmount quando COMEÇA a ser minha vez (não a cada update do Firebase)
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current && turnInfo) {
      setRaiseAmount(turnInfo.minRaise);
      setShowRaiseSlider(false);
    }
    wasMyTurn.current = !!isMyTurn;
  }, [isMyTurn, turnInfo]);

  useEffect(() => {
    const active = !(['showdown', 'waiting', 'handComplete'] as string[]).includes(gameState.phase);
    if (!active) return;
    const i = setInterval(() => setTimeLeft(Math.max(0, gameState.config.turnTimer - Math.floor((Date.now() - gameState.turnStartTime) / 1000))), 250);
    return () => clearInterval(i);
  }, [gameState.turnStartTime, gameState.phase, gameState.config.turnTimer]);

  useEffect(() => {
    if (gameState.phase !== 'showdown' || !gameState.showdownEndTime) return;
    const i = setInterval(() => setShowdownCountdown(Math.max(0, Math.ceil((gameState.showdownEndTime - Date.now()) / 1000))), 250);
    return () => clearInterval(i);
  }, [gameState.phase, gameState.showdownEndTime]);

  useEffect(() => { if (isMyTurn && navigator.vibrate) navigator.vibrate([200, 100, 200]); }, [isMyTurn]);

  const handleJoin = useCallback(() => { if (playerName.trim()) { gameStore.playerJoin(playerName.trim(), seat); setIsJoined(true); } }, [playerName, seat, gameStore]);
  const handleAction = useCallback((type: PlayerAction['type']) => {
    if (!isMyTurn || !playerId) return;
    gameStore.playerAction(playerId, type === 'raise' ? { type: 'raise', amount: raiseAmount } : { type });
    setShowRaiseSlider(false);
  }, [isMyTurn, playerId, raiseAmount, gameStore]);
  const handleLeave = useCallback(() => { if (playerId) gameStore.playerLeave(playerId); onLeave(); }, [playerId, gameStore, onLeave]);

  const callAmount = turnInfo?.callAmount || 0;
  const canCheck = turnInfo?.canCheck || false;
  const isPlaying = !(['showdown', 'waiting', 'handComplete'] as string[]).includes(gameState.phase);
  const isFolded = player?.isFolded || false;
  const isBusted = player && player.chips <= 0 && gameState.phase === 'showdown';
  const isShowdown = gameState.phase === 'showdown';

  // Determinar resultado do showdown
  const isWinner = player?.isWinner && (player?.winAmount || 0) > 0;
  const isTied = isShowdown && gameState.winners.length > 1 && gameState.winners.some(w => w.playerId === playerId);
  const isLoser = isShowdown && !isFolded && player && !isWinner && !isTied;

  // ==========================================
  // TELA DE ENTRADA
  // ==========================================
  if (!isJoined && !isPending) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
        <button onClick={onLeave} className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">← Voltar</button>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-1">POKER <span className="text-green-400">AIR</span></h1>
          <p className="text-gray-400 text-sm mt-2">Assento #{seat + 1}</p>
        </div>
        <div className="w-full max-w-xs">
          <input type="text" placeholder="Seu nome" value={playerName} onChange={(e) => setPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} maxLength={12}
            className="w-full px-6 py-4 bg-gray-800/80 border-2 border-gray-600 rounded-2xl text-white text-xl text-center focus:outline-none focus:border-green-500 placeholder-gray-600" autoFocus />
          <button onClick={handleJoin} disabled={!playerName.trim()}
            className={`w-full mt-4 py-4 text-xl font-black rounded-2xl transition-all ${playerName.trim() ? 'bg-gradient-to-b from-green-500 to-green-700 text-white active:scale-95 border border-green-400/30' : 'bg-gray-800 text-gray-600 border border-gray-700'}`}>
            ENTRAR NA MESA
          </button>
        </div>
      </div>
    );
  }

  // PENDENTE
  if (isPending || (isJoined && !player)) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
        <div className="text-4xl animate-pulse mb-4">⏳</div>
        <div className="text-yellow-400 text-lg font-bold mb-2">Esperando a próxima mão...</div>
        <button onClick={onLeave} className="mt-6 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm border border-gray-700">Desistir</button>
      </div>
    );
  }

  // WAITING
  if (gameState.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
        <LeaveModal isOpen={showLeaveModal} onConfirm={handleLeave} onCancel={() => setShowLeaveModal(false)} />
        <div className="text-4xl animate-pulse mb-4">🃏</div>
        <div className="text-green-400 text-xl font-bold mb-1">Olá, {player?.name}!</div>
        <div className="text-gray-400 mb-4">Aguardando início...</div>
        <button onClick={() => setShowLeaveModal(true)} className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm border border-gray-700">Sair da mesa</button>
      </div>
    );
  }

  // BUSTED
  if (isBusted) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-4">💸</div>
        <h2 className="text-2xl font-black text-red-400 mb-2">Saldo Insuficiente</h2>
        <p className="text-gray-400 mb-6">Eliminado da partida.</p>
        <button onClick={handleLeave} className="px-8 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-lg">Sair da Mesa</button>
      </div>
    );
  }

  // ==========================================
  // TELA DE JOGO — Layout compacto, sem scroll
  // ==========================================
  return (
    <div className="h-[100dvh] bg-[#0a0e17] flex flex-col overflow-hidden relative">
      <LeaveModal isOpen={showLeaveModal} onConfirm={handleLeave} onCancel={() => setShowLeaveModal(false)} />

      {/* Botão sair (X) */}
      <button onClick={() => setShowLeaveModal(true)} className="absolute top-2 right-2 z-30 w-8 h-8 rounded-full bg-gray-800/80 hover:bg-red-900/80 text-gray-500 hover:text-red-400 flex items-center justify-center text-sm border border-gray-700">✕</button>

      {/* === HEADER: Pot + Status === */}
      <div className={`px-4 pt-3 pb-2 shrink-0 ${isMyTurn ? 'bg-gradient-to-b from-yellow-900/40 to-transparent' : ''}`}>
        <div className="text-center">
          <div className="text-yellow-400 font-black text-2xl">${gameState.pot.toLocaleString()}</div>
          <div className={`text-xs font-bold mt-0.5 ${
            isFolded ? 'text-red-400' : isShowdown ? 'text-gray-400' : isMyTurn ? 'text-yellow-300 animate-pulse' : 'text-gray-500'
          }`}>
            {isFolded ? '❌ FOLD' : isShowdown ? `Próxima mão em ${showdownCountdown}s` : isMyTurn ? `SUA VEZ (${timeLeft}s)` : `Vez de ${currentTurnPlayer?.name || '...'}`}
          </div>
        </div>
        {isMyTurn && isPlaying && (
          <div className="w-full h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${timeLeft <= 10 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${(timeLeft / gameState.config.turnTimer) * 100}%` }} />
          </div>
        )}
      </div>

      {/* === COMUNITÁRIAS === */}
      {gameState.communityCards.length > 0 && (
        <div className="flex gap-1.5 justify-center px-4 py-1 shrink-0">
          {gameState.communityCards.map((card, i) => <SmallCard key={i} card={card} />)}
          {Array.from({ length: 5 - gameState.communityCards.length }, (_, i) => (
            <div key={`e-${i}`} className="w-10 h-14 rounded-md border border-gray-700/30 bg-gray-800/20" />
          ))}
        </div>
      )}

      {/* === CARTAS + FICHAS + RESULTADO (centro, flex-1) === */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {/* Resultado do showdown */}
        {isShowdown && !isFolded && player && (
          <div className={`rounded-2xl px-6 py-3 text-center mb-3 ${
            isWinner ? 'bg-green-900/30 border border-green-500/50' : isTied ? 'bg-yellow-900/30 border border-yellow-500/50' : isLoser ? 'bg-red-900/20 border border-red-700/30' : 'bg-gray-800/30 border border-gray-700/30'
          }`}>
            <div className="text-3xl mb-1">{isWinner ? '🏆' : isTied ? '🤝' : isLoser ? '😔' : '🃏'}</div>
            <div className={`font-bold text-sm ${isWinner ? 'text-green-400' : isTied ? 'text-yellow-400' : isLoser ? 'text-red-400' : 'text-gray-400'}`}>
              {isWinner ? 'Você Ganhou!' : isTied ? 'Empate!' : isLoser ? 'Você Perdeu' : 'Fim da mão'}
            </div>
            {player.handResult && <div className="text-gray-400 text-xs mt-0.5">{player.handResult.name}</div>}
            {isWinner && player.winAmount && player.winAmount > 0 && (
              <div className="text-green-400 font-black text-xl mt-1">+${player.winAmount.toLocaleString()}</div>
            )}
            {isTied && player.winAmount && player.winAmount > 0 && (
              <div className="text-yellow-400 font-black text-xl mt-1">+${player.winAmount.toLocaleString()}</div>
            )}
          </div>
        )}
        {isShowdown && isFolded && (
          <div className="rounded-2xl px-6 py-3 text-center mb-3 bg-gray-800/30 border border-gray-700/30">
            <div className="text-2xl mb-1">🃏</div>
            <div className="text-gray-500 text-sm">Você deu fold</div>
          </div>
        )}

        {/* Suas cartas */}
        {player && player.holeCards.length === 2 && !isFolded ? (
          <div className="flex gap-3 justify-center mb-3">
            {player.holeCards.map((card, i) => <MobileCard key={i} card={card} index={i} />)}
          </div>
        ) : !isFolded && !isShowdown ? (
          <div className="text-gray-700 text-3xl mb-3">🎴🎴</div>
        ) : null}

        {/* Fichas */}
        <div className="bg-gray-800/50 rounded-xl px-6 py-2 text-center border border-gray-700/50">
          <div className="text-yellow-400 font-black text-xl">${player?.chips?.toLocaleString() || '0'}</div>
        </div>
      </div>

      {/* === BOTÕES DE AÇÃO (fixo no fundo) === */}
      {!isFolded && isPlaying && (
        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shrink-0 bg-gradient-to-t from-[#0a0e17] to-transparent">
          {showRaiseSlider && isMyTurn && turnInfo ? (
            /* RAISE SLIDER */
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="range" min={turnInfo.minRaise} max={player?.chips ? player.chips + (player?.currentBet || 0) : turnInfo.minRaise} step={gameState.config.bigBlind} value={raiseAmount} onChange={(e) => setRaiseAmount(parseInt(e.target.value))} className="flex-1 h-2" />
                <span className="text-yellow-400 font-black text-lg min-w-[70px] text-right">${raiseAmount.toLocaleString()}</span>
              </div>
              <div className="flex gap-1.5">
                {[
                  { label: 'Mín', val: turnInfo.minRaise },
                  { label: '½Pot', val: Math.max(turnInfo.minRaise, Math.floor(gameState.pot / 2) + (player?.currentBet || 0)) },
                  { label: 'Pot', val: Math.max(turnInfo.minRaise, gameState.pot + (player?.currentBet || 0)) },
                  { label: 'All-In', val: player?.chips ? player.chips + (player?.currentBet || 0) : 0 },
                ].map(({ label, val }) => (
                  <button key={label} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRaiseAmount(val); }}
                    className={`flex-1 py-2.5 text-xs rounded-lg font-bold active:scale-95 ${label === 'All-In' ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRaiseSlider(false)} className="flex-1 py-3 bg-gray-700 text-gray-300 font-bold rounded-xl active:scale-95">Cancelar</button>
                <button onClick={() => handleAction('raise')} className="flex-1 py-3 bg-gradient-to-b from-green-500 to-green-700 text-white font-bold rounded-xl active:scale-95 border border-green-400/30">Raise ${raiseAmount.toLocaleString()}</button>
              </div>
            </div>
          ) : (
            /* BOTÕES PRINCIPAIS — Grid compacto, FOLD à direita */
            <div className="space-y-2">
              <div className="flex gap-2">
                {canCheck ? (
                  <button onClick={() => handleAction('check')} disabled={!isMyTurn}
                    className={`flex-1 py-3 text-lg font-black rounded-xl transition-all ${isMyTurn ? 'bg-blue-900/80 text-blue-200 active:scale-95 border border-blue-700/50 shadow-lg' : 'bg-gray-800/50 text-gray-700 border border-gray-800'}`}>
                    ✓ CHECK
                  </button>
                ) : (
                  <button onClick={() => handleAction('call')} disabled={!isMyTurn}
                    className={`flex-1 py-3 text-lg font-black rounded-xl transition-all ${isMyTurn ? 'bg-blue-900/80 text-blue-200 active:scale-95 border border-blue-700/50 shadow-lg' : 'bg-gray-800/50 text-gray-700 border border-gray-800'}`}>
                    CALL ${callAmount.toLocaleString()}
                  </button>
                )}
                <button onClick={() => handleAction('fold')} disabled={!isMyTurn}
                  className={`w-[72px] shrink-0 py-3 text-sm font-black rounded-xl transition-all ${isMyTurn ? 'bg-red-900/80 text-red-200 active:scale-95 border border-red-700/50' : 'bg-gray-800/50 text-gray-700 border border-gray-800'}`}>
                  FOLD
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRaiseSlider(true)} disabled={!isMyTurn}
                  className={`flex-1 py-3 text-lg font-black rounded-xl transition-all ${isMyTurn ? 'bg-gradient-to-b from-green-600/80 to-green-800/80 text-green-200 active:scale-95 border border-green-600/50 shadow-lg' : 'bg-gray-800/50 text-gray-700 border border-gray-800'}`}>
                  ↑ RAISE
                </button>
                <button onClick={() => handleAction('allin')} disabled={!isMyTurn}
                  className={`flex-1 py-3 text-lg font-black rounded-xl transition-all ${isMyTurn ? 'bg-gradient-to-b from-red-600/80 to-orange-800/80 text-orange-200 active:scale-95 border border-red-600/50 shadow-lg' : 'bg-gray-800/50 text-gray-700 border border-gray-800'}`}>
                  🔥 ALL-IN
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOLD ou SHOWDOWN: mensagem simples no fundo */}
      {(isFolded && isPlaying) && (
        <div className="px-4 pb-4 pt-2 text-center shrink-0"><span className="text-gray-600 text-xs">Aguardando próxima mão...</span></div>
      )}
    </div>
  );
}
