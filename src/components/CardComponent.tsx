// ================================================================
// POKER AIR — Componente de Carta
// Renderiza uma carta de poker estilizada
// ================================================================

import { useState, useEffect } from 'react';
import type { Card } from '../game/handEvaluator';
import { getCardDisplay } from '../game/gameLogic';

interface CardComponentProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  delay?: number;
}

export default function CardComponent({ card, faceDown = false, size = 'md', animate = false, delay = 0 }: CardComponentProps) {
  const [isFlipped, setIsFlipped] = useState(animate);

  useEffect(() => {
    if (animate && card) {
      const timer = setTimeout(() => setIsFlipped(false), delay + 100);
      return () => clearTimeout(timer);
    }
  }, [animate, card, delay]);

  const sizes = {
    sm: { w: 'w-[38px]', h: 'h-[54px]', rank: 'text-[10px]', suit: 'text-sm', rounded: 'rounded' },
    md: { w: 'w-[52px]', h: 'h-[74px]', rank: 'text-sm', suit: 'text-xl', rounded: 'rounded-lg' },
    lg: { w: 'w-[72px]', h: 'h-[100px]', rank: 'text-lg', suit: 'text-3xl', rounded: 'rounded-xl' },
  };

  const s = sizes[size];
  const showBack = faceDown || isFlipped || !card;

  if (showBack) {
    return (
      <div className={`${s.w} ${s.h} ${s.rounded} bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 border border-blue-400/50 flex items-center justify-center shadow-md transition-transform duration-500`}>
        <div className="text-blue-300/30 font-bold text-[8px] leading-none text-center">
          ♠♥<br/>♦♣
        </div>
      </div>
    );
  }

  const display = getCardDisplay(card);
  const isRed = display.color === 'red';
  const textColor = isRed ? 'text-red-600' : 'text-gray-900';

  return (
    <div
      className={`${s.w} ${s.h} ${s.rounded} bg-white border border-gray-200 flex flex-col items-center justify-center shadow-md transition-all duration-300`}
    >
      <span className={`font-black leading-none ${textColor} ${s.rank}`}>
        {display.rank}
      </span>
      <span className={`${textColor} ${s.suit} leading-none`}>
        {display.suitSymbol}
      </span>
    </div>
  );
}
