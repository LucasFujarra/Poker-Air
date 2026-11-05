export const TABLE_THEMES = {
  green: { label: 'Verde', felt: ['#1a5c2e', '#165a28', '#0f4a20'], accent: '#2a7a3e' },
  blue: { label: 'Azul', felt: ['#1e4e80', '#173f6b', '#102e50'], accent: '#4685bd' },
  red: { label: 'Vermelho', felt: ['#7a2636', '#641e2c', '#491521'], accent: '#b95166' },
  purple: { label: 'Roxo', felt: ['#57317d', '#452563', '#321b49'], accent: '#9160bb' },
  teal: { label: 'Turquesa', felt: ['#176564', '#125352', '#0c3c3b'], accent: '#309b96' },
  graphite: { label: 'Grafite', felt: ['#3d4652', '#303843', '#222a33'], accent: '#697789' },
} as const;

export type TableColor = keyof typeof TABLE_THEMES;

export function getTableTheme(color?: TableColor) {
  return TABLE_THEMES[color ?? 'green'] ?? TABLE_THEMES.green;
}

export function getTableBackground(theme: ReturnType<typeof getTableTheme>) {
  return `linear-gradient(to bottom right, ${theme.felt.join(', ')})`;
}
