export const PALETTE = {
  void: '#0B0F1C',
  hull: '#141B2F',
  grid: '#26304D',
  chalk: '#EDE6D1',
  dust: '#8C93A8',
  ember: '#FF5A2B',
  solar: '#FFC53D',
  coolant: '#3FD0C0',
  rust: '#A8452D',
} as const;

export type PaletteColor = keyof typeof PALETTE;
