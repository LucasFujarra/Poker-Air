import { useEffect, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import emojiData from 'emoji-picker-react/data/emojis-pt';
import { getEmojiColor } from '../game/emojiColor';

interface PlayerEmojiPickerProps {
  emoji: string;
  onChange: (emoji: string) => void | Promise<void>;
  disabled?: boolean;
}

export default function PlayerEmojiPicker({ emoji, onChange, disabled }: PlayerEmojiPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [emojiColor, setEmojiColor] = useState('#cbd5e1');

  useEffect(() => {
    let active = true;
    const updateColor = () => { if (active) setEmojiColor(getEmojiColor(emoji)); };
    void document.fonts.ready.then(updateColor).catch(updateColor);
    return () => { active = false; };
  }, [emoji]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const selectEmoji = async (value: string) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onChange(value);
      setOpen(false);
    } catch {
      setError('Não foi possível salvar o emoji. Tente novamente.');
    } finally { setSaving(false); }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || saving}
        aria-label="Escolher emoji do jogador"
        aria-haspopup="dialog"
        onClick={() => { setError(''); setOpen(true); }}
        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border-2 flex items-center justify-center text-2xl transition-[border-color,box-shadow,background-color] duration-300 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 shrink-0"
        style={{ borderColor: emojiColor, boxShadow: `0 0 14px ${emojiColor}33, inset 0 0 10px ${emojiColor}14` }}
      >
        {emoji}
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          aria-label="Escolher emoji do jogador"
          onCancel={() => setOpen(false)}
          onClick={event => { if (event.target === event.currentTarget && !saving) setOpen(false); }}
          className="m-auto w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-3 text-white backdrop:bg-black/80"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-bold">Escolha seu emoji</h2>
            <button type="button" aria-label="Fechar seletor de emojis" onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700">✕</button>
          </div>
          <div className={saving ? 'pointer-events-none opacity-60' : ''} aria-busy={saving}>
            <EmojiPicker
              emojiData={emojiData}
              theme="dark"
              emojiStyle="native"
              width="100%"
              height="min(420px, 65dvh)"
              autoFocusSearch={false}
              searchPlaceholder="Buscar emoji..."
              previewConfig={{ showPreview: false }}
              onEmojiClick={data => { void selectEmoji(data.emoji); }}
            />
          </div>
          {saving && <p role="status" className="mt-2 text-center text-sm text-gray-400">Salvando emoji...</p>}
          {error && <p role="alert" className="mt-2 text-center text-sm text-red-400">{error}</p>}
        </dialog>
      )}
    </>
  );
}
