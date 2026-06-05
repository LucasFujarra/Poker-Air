// ================================================================
// POKER AIR — Tela Inicial
// Logo premium e botão PLAY
// ================================================================

import { useState, useEffect } from 'react';

interface HomeScreenProps {
  onPlay: () => void;
}

export default function HomeScreen({ onPlay }: HomeScreenProps) {
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setGlow(g => !g), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Partículas de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradiente radial central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-green-900/20 blur-[100px]" />
        
        {/* Símbolos decorativos */}
        <div className="absolute top-[10%] left-[10%] text-[120px] text-green-500/5 rotate-12 select-none">♠</div>
        <div className="absolute top-[15%] right-[15%] text-[100px] text-red-500/5 -rotate-12 select-none">♥</div>
        <div className="absolute bottom-[15%] left-[20%] text-[90px] text-red-500/5 rotate-45 select-none">♦</div>
        <div className="absolute bottom-[20%] right-[10%] text-[110px] text-green-500/5 -rotate-45 select-none">♣</div>
        <div className="absolute top-[40%] left-[5%] text-[70px] text-yellow-500/5 rotate-30 select-none">♠</div>
        <div className="absolute bottom-[35%] right-[5%] text-[80px] text-yellow-500/5 -rotate-20 select-none">♥</div>
      </div>

      {/* Cartas decorativas atrás do logo */}
      <div className="relative z-10 mb-8">
        <div className="absolute -left-16 -top-4 w-16 h-22 bg-white/10 rounded-lg rotate-[-20deg] border border-white/10 backdrop-blur-sm flex items-center justify-center">
          <span className="text-red-500/40 text-2xl">A♥</span>
        </div>
        <div className="absolute -right-16 -top-4 w-16 h-22 bg-white/10 rounded-lg rotate-[20deg] border border-white/10 backdrop-blur-sm flex items-center justify-center">
          <span className="text-blue-400/40 text-2xl">A♠</span>
        </div>
      </div>

      {/* Logo principal */}
      <div className="relative z-10 text-center mb-12">
        {/* Ícone de fichas */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-400 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-bold">♥</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-600 border-2 border-green-400 flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">♠</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-yellow-600 border-2 border-yellow-400 flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">♦</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-bold">♣</span>
          </div>
        </div>

        {/* Título */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-400 tracking-wider mb-1 leading-none">
          POKER
        </h1>
        <h2 className={`text-5xl sm:text-6xl md:text-7xl font-black tracking-wider transition-all duration-1000 leading-none ${
          glow ? 'text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.5)]' : 'text-green-500 drop-shadow-[0_0_10px_rgba(74,222,128,0.2)]'
        }`}>
          AIR
        </h2>
        
        {/* Subtítulo */}
        <div className="mt-4 flex items-center gap-3 justify-center">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-600" />
          <p className="text-sm text-gray-500 tracking-[0.3em] uppercase font-medium">
            Texas Hold'em
          </p>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-600" />
        </div>
        
        <p className="text-xs text-gray-600 mt-3 tracking-widest uppercase">
          Multijogador Local • Até 9 Jogadores
        </p>
      </div>

      {/* Botão Play */}
      <button
        onClick={onPlay}
        className="relative z-10 group px-14 sm:px-16 py-5 sm:py-6 bg-gradient-to-b from-green-500 to-green-700 hover:from-green-400 hover:to-green-600 text-white text-2xl sm:text-3xl font-bold rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:shadow-[0_0_60px_rgba(34,197,94,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 border border-green-400/30"
      >
        <span className="flex items-center gap-3">
          <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          JOGAR
        </span>
      </button>

     

      {/* Footer */}
      <div className="absolute bottom-4 text-gray-800 text-[10px] tracking-widest">
        POKER AIR v1.0 - Lucas Fujarra
      </div>
    </div>
  );
}
