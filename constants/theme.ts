// CALLSHIELD Design System
// Theme: Deep-Space Navy + Electric Teal

export const Colors = {
  // Backgrounds
  bg: '#060E1E',
  bgSurface: '#0D1B2A',
  bgCard: '#112240',
  bgCardAlt: '#0F1E35',
  bgOverlay: 'rgba(6, 14, 30, 0.92)',

  // Brand
  primary: '#00B4D8',
  primaryLight: '#90E0EF',
  primaryDark: '#0077A8',
  primaryGlow: 'rgba(0, 180, 216, 0.18)',

  // Accent
  accent: '#48CAE4',

  // Status
  safe: '#00C896',
  safeGlow: 'rgba(0, 200, 150, 0.18)',
  safeDim: '#00A87A',

  warning: '#FFB700',
  warningGlow: 'rgba(255, 183, 0, 0.18)',
  warningDim: '#CC9200',

  danger: '#FF4757',
  dangerGlow: 'rgba(255, 71, 87, 0.18)',
  dangerDim: '#CC2233',

  // Text
  text: '#E8F4FD',
  textSecondary: '#8BA0B8',
  textMuted: '#4A6080',
  textInverse: '#060E1E',

  // Borders
  border: 'rgba(0, 180, 216, 0.15)',
  borderStrong: 'rgba(0, 180, 216, 0.35)',
  borderSubtle: 'rgba(139, 160, 184, 0.12)',

  // Tab bar
  tabActive: '#00B4D8',
  tabInactive: '#4A6080',
  tabBg: '#080F1C',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 38,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  primary: {
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  danger: {
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
