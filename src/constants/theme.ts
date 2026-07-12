// ===== constants/theme.ts =====

export type ThemeName = 'light' | 'dark';

const dark = {
  bg: '#0d1f2d',
  card: '#132333',
  blue: '#4da8da',
  muted: '#556677',
  gold: '#c9a84c',
  green: '#27ae60',
  white: '#ffffff',
  text: '#ddeeff',
  background: '#0d1f2d',
  backgroundElement: '#132333',
  backgroundSelected: '#1e3a4f',
  textSecondary: '#8899aa',
};

const light = {
  bg: '#6fabd1',
  card: '#ffffff',
  blue: '#1f6fa8',
  muted: '#4f7186',
  gold: '#330d79',
  green: '#1f7a45',
  white: '#130d0d',
  text: '#13202b',
  background: '#6fabd1',
  backgroundElement: '#ffffff',
  backgroundSelected: '#d0e8f5',
  textSecondary: '#4f6070',
};

export const Colors = { light, dark };

export const COLORS = dark;

export type ThemeColor = keyof typeof dark;

export const MaxContentWidth = 768;

export const Fonts = {
  regular: 'System',
  bold: 'System',
  mono: 'System',
};

export const Spacing = {
  xs: 4,
  small: 8,
  medium: 16,
  large: 24,
  xl: 32,
  xxl: 48,
  half: 4,
  one: 8,
  two: 16,
  three: 24,
  four: 32,
  five: 40,
};
