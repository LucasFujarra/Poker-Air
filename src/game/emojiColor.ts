const colorCache = new Map<string, string>();
const FALLBACK_COLOR = '#cbd5e1';

// Amostra o mesmo emoji nativo usado na interface, sem baixar imagens.
export function getEmojiColor(emoji: string): string {
  const cached = colorCache.get(emoji);
  if (cached) return cached;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return FALLBACK_COLOR;
    context.font = '36px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(emoji, 24, 24);

    const pixels = context.getImageData(0, 0, 48, 48).data;
    const colors = new Map<string, { weight: number; red: number; green: number; blue: number }>();
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, green, blue, alpha] = pixels.subarray(index, index + 4);
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      // Exclui bordas transparentes, contornos escuros e reflexos brancos.
      if (alpha < 128 || max < 50 || max - min < 30) continue;
      const weight = (alpha / 255) * ((max - min) / max);
      const key = `${red >> 5},${green >> 5},${blue >> 5}`;
      const color = colors.get(key) ?? { weight: 0, red: 0, green: 0, blue: 0 };
      color.weight += weight;
      color.red += red * weight;
      color.green += green * weight;
      color.blue += blue * weight;
      colors.set(key, color);
    }

    const dominant = [...colors.values()].sort((a, b) => b.weight - a.weight)[0];
    const result = dominant
      ? '#' + [dominant.red, dominant.green, dominant.blue]
        .map(value => Math.round(value / dominant.weight).toString(16).padStart(2, '0')).join('')
      : FALLBACK_COLOR;
    colorCache.set(emoji, result);
    return result;
  } catch {
    return FALLBACK_COLOR;
  }
}
