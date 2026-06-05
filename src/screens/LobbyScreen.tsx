// ================================================================
// POKER AIR — Sala de Espera (Online apenas)
// ================================================================

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { GameState, BotDifficulty } from '../game/gameLogic';

interface LobbyScreenProps {
  gameState: GameState;
  onStartGame: () => void;
  onAddBot: (name: string, seat: number) => void;
  onRemovePlayer: (playerId: string) => void;
  onSetBotDifficulty: (difficulty: BotDifficulty) => void;
  botDifficulty: BotDifficulty;
  baseUrl: string;
  roomId: string;
  onBack: () => void;
}

const BOT_NAMES = ['🤖 Carlos', '🤖 Maria', '🤖 João', '🤖 Giovana', '🤖 Pedro', '🤖 Ozzy', '🤖 Lucas', '🤖 Bia', '🤖 Billy'];
const SEAT_EMOJIS = ['🎯', '🎲', '🃏', '🎰', '🏆', '💎', '🔥', '⭐', '🎪'];

const DIFFICULTY_INFO: Record<BotDifficulty, { label: string; emoji: string; color: string; desc: string }> = {
  easy: { label: 'Fácil', emoji: '😊', color: 'text-green-400', desc: 'Joga passivo, comete erros' },
  medium: { label: 'Médio', emoji: '🎯', color: 'text-yellow-400', desc: 'Joga de forma equilibrada' },
  hard: { label: 'Difícil', emoji: '🧠', color: 'text-red-400', desc: 'Joga estrategicamente, blefa' },
};

// Modal QR grande
function QRModal({ isOpen, onClose, url, seat, roomId }: {
  isOpen: boolean; onClose: () => void; url: string; seat: number; roomId: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;
  const handleCopy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-3xl p-6 max-w-sm w-full border border-gray-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-xl">Assento {seat + 1}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button>
        </div>
        <div className="bg-white p-6 rounded-2xl mb-4">
          <QRCodeSVG value={url} size={280} level="H" bgColor="#ffffff" fgColor="#000000" />
        </div>
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 mb-3 text-center">
          <div className="text-xs text-green-400 uppercase tracking-wider mb-1">Sala</div>
          <div className="text-2xl font-mono font-black text-white tracking-[0.2em]">{roomId}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 mb-3">
          <div className="text-blue-400 text-xs font-mono break-all leading-relaxed">{url}</div>
        </div>
        <button onClick={handleCopy} className={`w-full py-3 rounded-xl font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
          {copied ? '✓ Copiado!' : '📋 Copiar Link'}
        </button>
      </div>
    </div>
  );
}

export default function LobbyScreen({ 
  gameState, onStartGame, onAddBot, onRemovePlayer, onSetBotDifficulty, botDifficulty,
  baseUrl, roomId, onBack 
}: LobbyScreenProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [qrModal, setQrModal] = useState<{ isOpen: boolean; seat: number; url: string }>({ isOpen: false, seat: 0, url: '' });
  
  const connectedPlayers = gameState.players.filter(p => p.isConnected);
  const botCount = gameState.players.filter(p => p.isBot).length;
  const humanCount = connectedPlayers.length - botCount;
  const canStart = connectedPlayers.length >= 2;

  const getPlayerUrl = (seat: number) => `${baseUrl}#/room/${roomId}/player/${seat}`;

  const handleAddBot = (seat: number) => {
    const usedNames = gameState.players.map(p => p.name);
    const availableName = BOT_NAMES.find(n => !usedNames.includes(n)) || `🤖 Bot ${seat + 1}`;
    onAddBot(availableName, seat);
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center p-4 md:p-6 overflow-y-auto">
      {/* Modal QR */}
      <QRModal isOpen={qrModal.isOpen} onClose={() => setQrModal({ ...qrModal, isOpen: false })} url={qrModal.url} seat={qrModal.seat} roomId={roomId} />

      {/* Header */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm">← Voltar</button>
        <div className="bg-green-900/50 text-green-400 border border-green-700/30 px-3 py-1 rounded-full text-xs font-bold">🌐 Online</div>
      </div>

      {/* Título */}
      <div className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-1">POKER <span className="text-green-400">AIR</span></h1>
        <h2 className="text-lg text-gray-400">Sala de Espera</h2>
        <div className="flex items-center justify-center gap-3 mt-2 text-sm">
          <span className="text-gray-500">{connectedPlayers.length}/9</span>
          {humanCount > 0 && <span className="text-blue-400">👤 {humanCount}</span>}
          {botCount > 0 && <span className="text-orange-400">🤖 {botCount}</span>}
        </div>
      </div>

      {/* Código da Sala */}
      <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 mb-4 max-w-md w-full text-center">
        <div className="text-xs text-green-400 uppercase tracking-wider mb-2">Código da Sala</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono font-black text-white tracking-[0.3em]">{roomId}</span>
          <button onClick={handleCopyRoomCode} className="text-green-400 hover:text-green-300 text-xl">
            {copiedRoom ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {/* Configurações */}
      <button onClick={() => setShowConfig(!showConfig)} className="text-sm text-gray-500 hover:text-gray-300 mb-3">⚙️ Configurações</button>

      {showConfig && (
        <div className="bg-gray-800/80 rounded-2xl p-4 mb-4 w-full max-w-md border border-gray-700">
          <label className="text-gray-400 text-xs block mb-2">🤖 Dificuldade dos Bots</label>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((diff) => {
              const info = DIFFICULTY_INFO[diff];
              const isActive = botDifficulty === diff;
              return (
                <button key={diff} onClick={() => onSetBotDifficulty(diff)}
                  className={`p-3 rounded-xl border-2 transition-all ${isActive ? `bg-gray-700 ${info.color} border-current` : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                  <div className="text-2xl mb-1">{info.emoji}</div>
                  <div className={`text-xs font-bold ${isActive ? info.color : ''}`}>{info.label}</div>
                </button>
              );
            })}
          </div>
          <p className="text-gray-500 text-[10px] mt-2 text-center">{DIFFICULTY_INFO[botDifficulty].desc}</p>
        </div>
      )}

      {/* Instrução */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 mb-4 max-w-2xl text-center">
        <p className="text-blue-300 text-xs">📱 Clique no <strong>QR code</strong> para ampliar, ou adicione um <strong>🤖 Bot</strong></p>
      </div>

      {/* Grid de assentos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 max-w-3xl w-full mb-6">
        {Array.from({ length: 9 }, (_, i) => {
          const player = gameState.players.find(p => p.seat === i);
          const seatUrl = getPlayerUrl(i);

          return (
            <div key={i} className={`rounded-2xl p-3 md:p-4 flex flex-col items-center justify-center min-h-[180px] md:min-h-[220px] transition-all duration-300 relative ${
              player ? player.isBot ? 'bg-orange-900/20 border-2 border-orange-500/50' : 'bg-green-900/30 border-2 border-green-500/50'
              : 'bg-gray-800/50 border-2 border-gray-700/50 hover:border-gray-500'
            }`}>
              {player ? (
                <div className="text-center">
                  {player.isBot && (
                    <button onClick={() => onRemovePlayer(player.id)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-900/50 hover:bg-red-700 text-red-300 hover:text-white text-sm flex items-center justify-center transition-colors border border-red-700/50">✕</button>
                  )}
                  <div className="text-4xl md:text-5xl mb-2">{player.isBot ? '🤖' : SEAT_EMOJIS[i]}</div>
                  <div className="text-white font-bold text-lg">{player.name}</div>
                  <div className={`text-sm mt-1 ${player.isBot ? 'text-orange-400' : 'text-green-400'}`}>Assento {i + 1}</div>
                  {player.isBot && <div className="text-orange-400/60 text-xs mt-1">{DIFFICULTY_INFO[player.botDifficulty || botDifficulty].emoji} {DIFFICULTY_INFO[player.botDifficulty || botDifficulty].label}</div>}
                  <div className={`flex items-center justify-center gap-1 text-xs mt-2 ${player.isBot ? 'text-orange-500' : 'text-green-500'}`}>
                    <span className={`w-2 h-2 rounded-full animate-pulse ${player.isBot ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                    {player.isBot ? 'Bot' : 'Conectado'}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-gray-400 text-sm font-bold mb-2">Assento {i + 1}</div>
                  <button onClick={() => setQrModal({ isOpen: true, seat: i, url: seatUrl })} className="bg-white p-2 rounded-xl inline-block shadow-lg mb-2 hover:scale-105 transition-transform">
                    <QRCodeSVG value={seatUrl} size={80} level="M" bgColor="#ffffff" fgColor="#000000" />
                  </button>
                  <div className="text-gray-600 text-[9px] mb-2">Clique para ampliar</div>
                  <button onClick={() => handleAddBot(i)} className="px-4 py-2 bg-orange-800/50 hover:bg-orange-700/50 text-orange-300 text-xs rounded-lg border border-orange-600/30 font-bold">🤖 Bot</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botão Iniciar */}
      <button onClick={onStartGame} disabled={!canStart}
        className={`px-10 md:px-14 py-4 md:py-5 text-xl md:text-2xl font-black rounded-2xl transition-all duration-300 ${
          canStart ? 'bg-gradient-to-b from-green-500 to-green-700 text-white shadow-xl shadow-green-500/30 hover:scale-105 active:scale-95 border border-green-400/30' : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
        }`}>
        {canStart ? 'INICIAR JOGO' : `Mínimo 2 jogadores`}
      </button>
    </div>
  );
}
