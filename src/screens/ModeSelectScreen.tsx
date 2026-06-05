// ================================================================
// POKER AIR — Seleção de Modo (Online apenas)
// ================================================================

import { useState, useEffect } from 'react';
import { createRoom, roomExists, subscribeToRooms, timeAgo } from '../game/roomManager';
import type { RoomInfo } from '../game/roomManager';
import { getMyRooms, removeMyRoom, formatTime } from '../game/roomHistory';
import type { MyRoom } from '../game/roomHistory';

interface ModeSelectScreenProps {
  onSelectOnlineHost: (roomId: string) => void;
  onSelectOnlineJoin: (roomId: string) => void;
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'Aguardando', preflop: 'Em partida', flop: 'Em partida',
  turn: 'Em partida', river: 'Em partida', showdown: 'Showdown',
};

export default function ModeSelectScreen({ onSelectOnlineHost, onSelectOnlineJoin }: ModeSelectScreenProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joiningCode, setJoiningCode] = useState('');

  useEffect(() => { setMyRooms(getMyRooms()); }, [mode]);
  useEffect(() => { if (mode !== 'create') return; return subscribeToRooms((r) => setRooms(r)); }, [mode]);

  const handleCreateRoom = async () => {
    setIsCreating(true); setError('');
    const result = await createRoom();
    if (result.ok) onSelectOnlineHost(result.code); else setError(result.reason);
    setIsCreating(false);
  };

  const handleJoinRoom = async () => {
    const code = roomCode.toUpperCase().trim();
    if (code.length < 4) { setJoinError('Código inválido'); return; }
    setJoinError(''); setJoiningCode(code);
    const exists = await roomExists(code);
    setJoiningCode('');
    if (!exists) { setJoinError('Sala não encontrada.'); return; }
    onSelectOnlineJoin(code);
  };

  const handleReconnect = async (room: MyRoom) => {
    setJoiningCode(room.code);
    const exists = await roomExists(room.code);
    setJoiningCode('');
    if (!exists) { removeMyRoom(room.code); setMyRooms(getMyRooms()); return; }
    if (room.role === 'host') onSelectOnlineHost(room.code); else onSelectOnlineJoin(room.code);
  };

  const handleRemoveFromHistory = (code: string) => { removeMyRoom(code); setMyRooms(getMyRooms()); };

  // ==========================================
  // SELEÇÃO
  // ==========================================
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl text-red-500">♥</span><span className="text-3xl text-white">♠</span><span className="text-3xl text-red-500">♦</span><span className="text-3xl text-white">♣</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-2">POKER <span className="text-green-400">AIR</span></h1>
          <p className="text-gray-500">Texas Hold'em Multiplayer</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setMode('create')} className="w-full p-5 bg-gradient-to-br from-green-800/50 to-green-950/50 border-2 border-green-600/50 hover:border-green-400 rounded-2xl transition-all group">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🖥️</div>
              <div className="text-left flex-1">
                <div className="text-white font-bold text-lg group-hover:text-green-400">Host</div>
                <div className="text-gray-400 text-sm">Exiba na TV para todos verem</div>
              </div>
            </div>
          </button>
          <button onClick={() => setMode('join')} className="w-full p-5 bg-gradient-to-br from-blue-900/50 to-blue-950/50 border-2 border-blue-700/50 hover:border-blue-500 rounded-2xl transition-all group">
            <div className="flex items-center gap-4">
              <div className="text-4xl">📱</div>
              <div className="text-left flex-1">
                <div className="text-white font-bold text-lg group-hover:text-blue-400">Jogar</div>
                <div className="text-gray-500 text-sm">Entre pelo celular com o código</div>
              </div>
            </div>
          </button>
        </div>
        {myRooms.length > 0 && (
          <div className="w-full max-w-sm mt-8">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-3 text-center">Suas Salas Recentes</div>
            <div className="space-y-2">
              {myRooms.slice(0, 5).map((room) => (
                <div key={`${room.code}-${room.role}`} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${room.role === 'host' ? 'bg-green-900/50 border border-green-700/30' : 'bg-blue-900/50 border border-blue-700/30'}`}>
                    <span className="text-lg">{room.role === 'host' ? '🖥️' : '📱'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white tracking-wider">{room.code}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${room.role === 'host' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>{room.role === 'host' ? 'Host' : 'Jogador'}</span>
                    </div>
                    <div className="text-gray-500 text-xs">{formatTime(room.lastAccess)}</div>
                  </div>
                  <button onClick={() => handleReconnect(room)} disabled={joiningCode === room.code} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg shrink-0 disabled:opacity-50">
                    {joiningCode === room.code ? '...' : 'Entrar'}
                  </button>
                  <button onClick={() => handleRemoveFromHistory(room.code)} className="text-gray-600 hover:text-red-400 text-sm shrink-0">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SELEÇÃO DE SALA (HOST)
  // ==========================================
  if (mode === 'create') {
    const activeRooms = rooms.filter(r => r.isActive);
    const inactiveCount = rooms.filter(r => !r.isActive).length;
    const canCreate = rooms.length < 10 || inactiveCount > 0;
    const hostHistory = myRooms.filter(r => r.role === 'host');

    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center p-6 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setMode('select')} className="text-gray-500 hover:text-gray-300 text-sm">← Voltar</button>
            <div className="text-gray-500 text-xs">{activeRooms.length} ativa{activeRooms.length !== 1 ? 's' : ''} • {10 - rooms.length + inactiveCount} livre{10 - rooms.length + inactiveCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-white mb-1">🖥️ Seleção de Sala</h1>
            <p className="text-gray-500 text-sm">Crie uma nova ou entre em uma existente</p>
          </div>
          <button onClick={handleCreateRoom} disabled={!canCreate || isCreating}
            className={`w-full py-4 font-black text-xl rounded-2xl transition-all mb-5 ${canCreate && !isCreating ? 'bg-gradient-to-b from-green-500 to-green-700 text-white hover:scale-[1.02] active:scale-95 border border-green-400/30 shadow-lg shadow-green-500/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}>
            {isCreating ? '⏳ Criando...' : canCreate ? '+ NOVA SALA' : '🚫 Todas ocupadas'}
          </button>
          {error && <div className="bg-red-900/30 border border-red-700/30 rounded-xl p-3 mb-4 text-center"><p className="text-red-400 text-sm">{error}</p></div>}
          {hostHistory.length > 0 && (
            <div className="mb-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">Suas salas recentes</div>
              <div className="space-y-2">
                {hostHistory.slice(0, 3).map((room) => (
                  <div key={room.code} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                    <span className="font-mono font-bold text-white tracking-wider">{room.code}</span>
                    <span className="text-gray-500 text-xs flex-1">{formatTime(room.lastAccess)}</span>
                    <button onClick={() => handleReconnect(room)} disabled={joiningCode === room.code} className="px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 text-green-300 text-xs font-bold rounded-lg border border-green-700/30 disabled:opacity-50">
                      {joiningCode === room.code ? '...' : 'Entrar'}
                    </button>
                    <button onClick={() => handleRemoveFromHistory(room.code)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeRooms.length > 0 && (
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50"><span className="text-white font-bold text-sm">Salas Ativas no Servidor</span></div>
              <div className="divide-y divide-gray-700/30">
                {activeRooms.map((room) => (
                  <div key={room.code} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <div className="font-mono font-bold text-white tracking-wider">{room.code}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-green-400 text-xs font-bold">{PHASE_LABELS[room.phase] || room.phase}</span>
                      <span className="text-gray-600 text-xs ml-2">{timeAgo(room.updatedAt)}</span>
                      <div className="text-gray-500 text-xs">👤 {room.playerCount}</div>
                    </div>
                    <button onClick={() => onSelectOnlineHost(room.code)} className="px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 text-green-300 text-xs font-bold rounded-lg border border-green-700/30">Entrar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeRooms.length === 0 && hostHistory.length === 0 && !isCreating && (
            <div className="text-center text-gray-600 text-sm mt-4"><div className="text-3xl mb-2">🃏</div>Nenhuma sala ativa. Crie uma nova!</div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // JOGAR (entrada de código)
  // ==========================================
  if (mode === 'join') {
    const playerHistory = myRooms.filter(r => r.role === 'player');
    return (
      <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">📱 Jogar</h1>
          <p className="text-gray-500">Peça o código ao host</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <input type="text" value={roomCode} onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setJoinError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()} placeholder="CÓDIGO" maxLength={6}
            className="w-full px-6 py-5 bg-gray-800 border-2 border-gray-600 rounded-2xl text-white text-3xl text-center font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 placeholder-gray-600 uppercase" autoFocus />
          {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
          <button onClick={handleJoinRoom} disabled={roomCode.length < 4 || !!joiningCode}
            className={`w-full py-5 font-black text-xl rounded-2xl transition-all border ${roomCode.length >= 4 && !joiningCode ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-blue-400/30 hover:scale-105 active:scale-95 shadow-lg' : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'}`}>
            {joiningCode ? '⏳ Verificando...' : 'CONTINUAR →'}
          </button>
          {playerHistory.length > 0 && (
            <div className="mt-2">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-2 text-center">Salas recentes</div>
              <div className="space-y-2">
                {playerHistory.slice(0, 4).map((room) => (
                  <div key={room.code} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3">
                    <span className="font-mono font-bold text-white tracking-wider">{room.code}</span>
                    <span className="text-gray-500 text-xs flex-1">{formatTime(room.lastAccess)}</span>
                    <button onClick={() => handleReconnect(room)} disabled={joiningCode === room.code} className="px-3 py-1.5 bg-blue-800/50 hover:bg-blue-700/50 text-blue-300 text-xs font-bold rounded-lg disabled:opacity-50">
                      {joiningCode === room.code ? '...' : 'Entrar'}
                    </button>
                    <button onClick={() => handleRemoveFromHistory(room.code)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setMode('select')} className="w-full py-3 text-gray-500 hover:text-gray-300">← Voltar</button>
        </div>
      </div>
    );
  }

  return null;
}
