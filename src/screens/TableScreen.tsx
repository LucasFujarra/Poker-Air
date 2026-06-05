// ================================================================
// POKER AIR — Mesa do Jogo (Host)
// Mesa 100% fixa — cards de altura fixa, sem movimentação
// ================================================================

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { GameState, BotDifficulty, Player } from '../game/gameLogic';
import CardComponent from '../components/CardComponent';

interface TableScreenProps {
  gameState: GameState;
  onNextHand: () => void;
  onBackToLobby: () => void;
  onAddBot: (name: string, seat: number) => void;
  onRemoveBot: (playerId: string) => void;
  botDifficulty: BotDifficulty;
  baseUrl: string;
  roomId: string;
}

// Posições ajustadas — jogadores mais próximos da mesa
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: '-2%',  left: '50%' },   // topo centro
  { top: '2%',   left: '78%' },   // topo dir
  { top: '30%',  left: '93%' },   // meio dir
  { top: '58%',  left: '85%' },   // baixo dir
  { top: '75%',  left: '67%' },   // baixo centro-dir
  { top: '75%',  left: '33%' },   // baixo centro-esq
  { top: '58%',  left: '15%' },   // baixo esq
  { top: '30%',  left: '7%' },    // meio esq
  { top: '2%',   left: '22%' },   // topo esq
];

const SEAT_EMOJIS = ['🎯','🎲','🃏','🎰','🏆','💎','🔥','⭐','🎪'];
const BOT_NAMES = ['🤖 Carlos','🤖 Maria','🤖 João','🤖 Giovana','🤖 Pedro','🤖 Ozzy','🤖 Lucas','🤖 Bia','🤖 Billy'];
const DIFF_INFO: Record<BotDifficulty,{emoji:string}> = {easy:{emoji:'😊'},medium:{emoji:'🎯'},hard:{emoji:'🧠'}};

function QRZoomModal({isOpen,onClose,url,seat,roomId}:{isOpen:boolean;onClose:()=>void;url:string;seat:number;roomId:string}) {
  const [copied,setCopied]=useState(false);
  if(!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-3xl p-6 max-w-sm w-full border border-gray-700" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-white font-bold text-xl">Assento {seat+1}</h3><button onClick={onClose} className="text-gray-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button></div>
        <div className="bg-white p-6 rounded-2xl mb-4"><QRCodeSVG value={url} size={280} level="H"/></div>
        {roomId&&<div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 mb-3 text-center"><div className="text-xs text-green-400 uppercase tracking-wider mb-1">Sala</div><div className="text-2xl font-mono font-black text-white tracking-[0.2em]">{roomId}</div></div>}
        <button onClick={()=>{navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000)}} className={`w-full py-3 rounded-xl font-bold ${copied?'bg-green-600 text-white':'bg-gray-700 hover:bg-gray-600 text-white'}`}>{copied?'✓ Copiado!':'📋 Copiar Link'}</button>
      </div>
    </div>
  );
}

function PlayersModal({isOpen,onClose,gameState,onAddBot,onRemoveBot,botDifficulty,baseUrl,roomId}:{isOpen:boolean;onClose:()=>void;gameState:GameState;onAddBot:(n:string,s:number)=>void;onRemoveBot:(id:string)=>void;botDifficulty:BotDifficulty;baseUrl:string;roomId:string}) {
  const [qrZoom,setQrZoom]=useState<{open:boolean;seat:number;url:string}>({open:false,seat:0,url:''});
  if(!isOpen) return null;
  const getUrl=(s:number)=>`${baseUrl}#/room/${roomId}/player/${s}`;
  const addBot=(s:number)=>{const u=gameState.players.map(p=>p.name);onAddBot(BOT_NAMES.find(n=>!u.includes(n))||`🤖 Bot ${s+1}`,s);};
  return (
    <><QRZoomModal isOpen={qrZoom.open} onClose={()=>setQrZoom({...qrZoom,open:false})} url={qrZoom.url} seat={qrZoom.seat} roomId={roomId}/>
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-gray-900 rounded-3xl p-4 max-w-lg w-full border border-gray-700 max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-white font-bold text-lg">👥 Jogadores ({gameState.players.length}/9)</h3><button onClick={onClose} className="text-gray-500 hover:text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800">✕</button></div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Array.from({length:9},(_,i)=>{const p=gameState.players.find(pl=>pl.seat===i);const url=getUrl(i);return(
            <div key={i} className={`rounded-xl p-2.5 flex flex-col items-center justify-center min-h-[140px] relative ${p?p.isBot?'bg-orange-900/20 border border-orange-500/40':'bg-green-900/20 border border-green-500/40':'bg-gray-800/50 border border-gray-700/50'}`}>
              {p?(<>{p.isBot&&<button onClick={()=>onRemoveBot(p.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-900/60 hover:bg-red-700 text-red-300 hover:text-white text-[10px] flex items-center justify-center">✕</button>}
                <span className="text-2xl mb-1">{p.isBot?'🤖':SEAT_EMOJIS[i]}</span><span className="text-white text-xs font-bold truncate max-w-[80px]">{p.name}</span>
                <span className={`text-[10px] mt-0.5 ${p.isBot?'text-orange-400':'text-green-400'}`}>{p.isBot?`Bot ${DIFF_INFO[p.botDifficulty||botDifficulty].emoji}`:'Jogador'}</span>
                <span className="text-yellow-400 text-[10px] font-mono">${p.chips.toLocaleString()}</span></>):(<>
                <div className="text-gray-500 text-[10px] mb-1 font-bold">Assento {i+1}</div>
                <button onClick={()=>setQrZoom({open:true,seat:i,url})} className="bg-white p-1 rounded-lg shadow-md mb-1.5 hover:scale-105 transition-transform"><QRCodeSVG value={url} size={55} level="M"/></button>
                <button onClick={()=>addBot(i)} className="px-2 py-1 bg-orange-800/40 hover:bg-orange-700/50 text-orange-300 text-[10px] rounded-lg border border-orange-600/30 font-bold">🤖 Bot</button></>)}
            </div>);})}
        </div>
      </div>
    </div></>
  );
}

function ShowdownInfo({gameState,playersWithChips,onNextHand,onBackToLobby}:{gameState:GameState;playersWithChips:Player[];onNextHand:()=>void;onBackToLobby:()=>void}) {
  const [cd,setCd]=useState(5);
  useEffect(()=>{if(!gameState.showdownEndTime) return;const i=setInterval(()=>setCd(Math.max(0,Math.ceil((gameState.showdownEndTime-Date.now())/1000))),250);return()=>clearInterval(i);},[gameState.showdownEndTime]);
  if(playersWithChips.length<2) return(<div className="text-center"><div className="text-yellow-400 font-black text-xl">🏆 JOGO ENCERRADO!</div><div className="text-green-400 font-bold text-lg mt-1">{playersWithChips[0]?.name} venceu!</div><button onClick={onBackToLobby} className="mt-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-sm">Lobby</button></div>);
  return (
    <div className="text-center">
      <div className="flex flex-wrap gap-2 justify-center mb-2">
        {gameState.winners.map((w,i)=>{const wp=gameState.players.find(p=>p.id===w.playerId);return(
          <div key={i} className="bg-green-900/40 border border-green-600/40 rounded-lg px-3 py-1.5"><span className="mr-1">🏆</span><span className="text-green-400 font-bold text-sm">{wp?.name}</span><span className="text-yellow-400 font-bold text-sm ml-2">${w.amount.toLocaleString()}</span>{w.hand&&<span className="text-gray-400 text-xs ml-1">({w.hand})</span>}</div>
        );})}
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="text-white font-black text-lg">Próxima mão em {cd}s</span>
        <button onClick={onNextHand} className="px-4 py-1.5 bg-green-700/60 hover:bg-green-600/60 text-green-200 font-bold rounded-lg border border-green-600/30 text-sm">Agora</button>
      </div>
    </div>
  );
}

// Card do jogador com ALTURA FIXA — nunca muda de tamanho
function PlayerCard({ player, isTurn, isDealer, isSB, isBB, isWin, isShowdown, timeLeft }: {
  player: Player; isTurn: boolean; isDealer: boolean; isSB: boolean; isBB: boolean; isWin: boolean; isShowdown: boolean; timeLeft: number;
}) {
  // Borda muda de cor mas dimensões NUNCA mudam
  const borderClass = player.isFolded ? 'bg-gray-900/70 border border-gray-800/50 opacity-40'
    : isTurn ? 'bg-yellow-950/90 border-2 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.25)]'
    : isWin ? 'bg-green-950/90 border-2 border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.25)]'
    : player.isAllIn ? 'bg-red-950/90 border-2 border-red-600'
    : 'bg-gray-900/80 border border-gray-600/50';

  return (
    <div className="flex flex-col items-center">
      {/* Badges — MAIOR */}
      <div className="flex gap-1 mb-1 h-5">
        {player.isBot && <span className="bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">🤖</span>}
        {isDealer && <span className="bg-yellow-300 text-black text-[9px] font-black px-2 py-0.5 rounded-full leading-none">D</span>}
        {isSB && <span className="bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">SB</span>}
        {isBB && <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">BB</span>}
      </div>

      {/* Card — altura fixa, MAIOR */}
      <div className={`w-[120px] md:w-[160px] h-[95px] md:h-[125px] rounded-xl text-center backdrop-blur-sm flex flex-col items-center justify-center ${borderClass}`}>
        <div className="text-white font-bold text-sm md:text-base truncate max-w-[105px] md:max-w-[140px] leading-tight">{player.name}</div>
        <div className={`text-xs md:text-sm font-mono font-bold leading-tight ${player.chips > 0 ? 'text-yellow-400' : 'text-red-500'}`}>${player.chips.toLocaleString()}</div>

        {/* Status — sempre ocupa espaço fixo */}
        <div className="h-4 flex items-center justify-center">
          {player.isFolded && <span className="text-[9px] md:text-[11px] text-gray-500 font-bold">FOLD</span>}
          {player.isAllIn && !player.isFolded && <span className="text-[9px] md:text-[11px] text-red-400 font-bold">ALL-IN</span>}
          {isTurn && !player.isFolded && !player.isAllIn && <span className="text-yellow-400 text-[9px] md:text-[11px] font-bold">⏱ {timeLeft}s</span>}
          {isWin && player.winAmount && player.winAmount > 0 && <span className="text-green-400 text-[10px] md:text-sm font-bold">+${player.winAmount.toLocaleString()}</span>}
        </div>

        {/* Cartas — sempre ocupa espaço fixo */}
        <div className="h-[26px] md:h-[32px] flex items-center justify-center gap-0.5 mt-1">
          {!isShowdown && !player.isFolded && player.holeCards.length > 0 && (<>
            <div className="w-[17px] h-[24px] md:w-[20px] md:h-[28px] bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border border-blue-400/30" />
            <div className="w-[17px] h-[24px] md:w-[20px] md:h-[28px] bg-gradient-to-br from-blue-600 to-blue-800 rounded-sm border border-blue-400/30" />
          </>)}
          {isShowdown && !player.isFolded && player.holeCards.length > 0 && player.holeCards.map((card,i) => <CardComponent key={i} card={card} size="sm" />)}
        </div>

        {/* Hand name */}
        {isShowdown && player.handResult && !player.isFolded && (
          <div className="text-[8px] md:text-[9px] text-green-300 font-bold leading-none">{player.handResult.name}</div>
        )}
      </div>

      {/* Aposta — espaço fixo */}
      <div className="h-6 flex items-center mt-1">
        {player.currentBet > 0 && !player.isFolded && (
          <div className="bg-black/60 px-2 py-0.5 rounded-full border border-yellow-500/30">
            <span className="text-yellow-300 text-[10px] md:text-xs font-mono font-bold">${player.currentBet.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// TABLE SCREEN
// ==========================================
export default function TableScreen({ gameState, onNextHand, onBackToLobby, onAddBot, onRemoveBot, botDifficulty, baseUrl, roomId }: TableScreenProps) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    if (gameState.phase === 'showdown' || gameState.phase === 'waiting' || gameState.phase === 'handComplete') return;
    const i = setInterval(() => setTimeLeft(Math.max(0, gameState.config.turnTimer - Math.floor((Date.now() - gameState.turnStartTime) / 1000))), 250);
    return () => clearInterval(i);
  }, [gameState.turnStartTime, gameState.phase, gameState.config.turnTimer]);

  const currentPlayer = gameState.currentPlayerIndex >= 0 ? gameState.players[gameState.currentPlayerIndex] : null;
  const playersWithChips = useMemo(() => gameState.players.filter(p => p.chips > 0), [gameState.players]);
  const isShowdown = gameState.phase === 'showdown';

  return (
    <div className="h-[100dvh] bg-[#0a0e17] flex flex-col overflow-hidden">
      <PlayersModal isOpen={showPlayers} onClose={() => setShowPlayers(false)} gameState={gameState}
        onAddBot={onAddBot} onRemoveBot={onRemoveBot} botDifficulty={botDifficulty} baseUrl={baseUrl} roomId={roomId} />

      {/* Header — MAIOR */}
      <div className="flex items-center justify-between px-4 py-2.5 z-20 bg-black/40 border-b border-gray-800/50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBackToLobby} className="text-gray-400 hover:text-gray-200 text-sm px-3 py-1.5 rounded hover:bg-gray-800/50">← Lobby</button>
          <span className="text-white font-black text-base md:text-lg">POKER <span className="text-green-400">AIR</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-mono">Mão #{gameState.handNumber}</span>
          <button onClick={() => setShowPlayers(true)} className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700">
            <span className="text-sm">👥</span><span className="text-white text-sm font-bold">{gameState.players.length} jogadores</span>
          </button>
        </div>
      </div>

      {/* Mesa — preenche todo o espaço */}
      <div className="flex-1 flex items-center justify-center p-1 min-h-0">
        <div className="relative w-full h-full max-w-[1200px]">

          {/* Oval verde — MAIOR */}
          <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-br from-[#1a5c2e] via-[#165a28] to-[#0f4a20] border-[10px] border-[#6b3a1f] shadow-[0_0_80px_rgba(0,0,0,0.6),inset_0_0_50px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-4 rounded-[50%] border-2 border-[#2a7a3e]/30" />

            {/* Centro da mesa */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-[85%]">
              {/* Cartas — MAIORES */}
              <div className="flex gap-3 justify-center mb-3">
                {gameState.communityCards.map((card, i) => <CardComponent key={`c-${i}`} card={card} size="lg" animate delay={i*150} />)}
                {Array.from({length:5-gameState.communityCards.length},(_,i)=>(
                  <div key={`e-${i}`} className="w-[80px] h-[110px] rounded-xl border-2 border-[#2a7a3e]/30 bg-[#1a5c2e]/30" />
                ))}
              </div>

              {/* Pote — MAIOR */}
              <div className="bg-black/30 px-6 py-2 rounded-full inline-block border border-yellow-500/20 mb-2">
                <span className="text-yellow-400 font-black text-2xl md:text-3xl">💰 ${gameState.pot.toLocaleString()}</span>
              </div>

              {/* Status — MAIOR */}
              {currentPlayer && !isShowdown && (
                <div>
                  <div className="inline-flex items-center gap-2 bg-yellow-900/40 border border-yellow-700/30 px-5 py-1.5 rounded-full">
                    <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-yellow-300 font-bold text-base md:text-lg">Vez de {currentPlayer.name}</span>
                    <span className="text-yellow-500/70 font-mono text-sm">{timeLeft}s</span>
                  </div>
                </div>
              )}
              {isShowdown && <ShowdownInfo gameState={gameState} playersWithChips={playersWithChips} onNextHand={onNextHand} onBackToLobby={onBackToLobby} />}
            </div>
          </div>

          {/* Jogadores — posições fixas, componente de altura fixa */}
          {SEAT_POSITIONS.map((pos, seatIdx) => {
            const player = gameState.players.find(p => p.seat === seatIdx);
            if (!player) return null;
            const isTurn = currentPlayer?.id === player.id;
            const isDealer = gameState.dealerIndex >= 0 && gameState.players[gameState.dealerIndex]?.id === player.id;
            const isSB = gameState.smallBlindIndex >= 0 && gameState.players[gameState.smallBlindIndex]?.id === player.id;
            const isBB = gameState.bigBlindIndex >= 0 && gameState.players[gameState.bigBlindIndex]?.id === player.id;
            const isWin = !!player.isWinner;

            return (
              <div key={seatIdx} className="absolute z-10" style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}>
                <PlayerCard player={player} isTurn={isTurn} isDealer={isDealer} isSB={isSB} isBB={isBB} isWin={isWin} isShowdown={isShowdown} timeLeft={timeLeft} />
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}
