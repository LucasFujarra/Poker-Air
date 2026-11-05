import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GameState } from '../game/gameLogic';
import { getSoundCues, getSoundSnapshot } from '../audio/soundEvents';
import type { SoundSnapshot, SoundCue } from '../audio/soundEvents';
import { playSoundCues, subscribeToAudioState, isAudioReady, resumeExistingAudio } from '../audio/gameAudio';

export function useGameSounds(state: GameState, options: { seat?: number; host?: boolean; enabled?: boolean } = {}) {
  const previous = useRef<SoundSnapshot | null>(null);
  const pending = useRef<{ cues: SoundCue[]; createdAt: number } | null>(null);
  const audioReady = useSyncExternalStore(subscribeToAudioState, isAudioReady);
  useEffect(() => {
    if (options.enabled === false) { previous.current = null; pending.current = null; return; }
    const current = getSoundSnapshot(state, options.seat);
    // Se o celular ainda bloqueia áudio, preserva apenas o aviso da vez atual.
    // Quando o áudio for liberado, confirma a vez novamente antes de tocar.
    if (!options.host && !audioReady) {
      previous.current = { ...current, turn: '' };
      resumeExistingAudio();
      return;
    }
    const cues = getSoundCues(previous.current, current, options.host);
    previous.current = current;
    if (!audioReady) {
      if (cues.length && !document.hidden) pending.current = { cues, createdAt: Date.now() };
      resumeExistingAudio();
      return;
    }
    const recentPending = pending.current && Date.now() - pending.current.createdAt < 1500 ? pending.current.cues : [];
    pending.current = null;
    playSoundCues(cues.length ? cues : recentPending);
  }, [state, options.seat, options.host, options.enabled, audioReady]);
}
