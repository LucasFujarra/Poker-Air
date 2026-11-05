export const SEAT_EMOJIS = ['🎯', '🎲', '🃏', '🎰', '🏆', '💎', '🔥', '⭐', '🎪'];

export function getPlayerEmoji(player: { isBot?: boolean; emoji?: string; seat: number }) {
  return player.isBot ? '🤖' : player.emoji || SEAT_EMOJIS[player.seat] || '🙂';
}
