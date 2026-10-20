// The web's design tokens (src/styles/index.css), carried over. Use nothing else.
export const colors = {
  red: '#A31621',
  redInk: '#8C121C',
  paper: '#E5ECE9',
  surface: '#F2F5F3',
  surface2: '#FBFCFB',
  surface3: '#E9EEEB',
  green: '#12695F',
  ink: '#1F1300',
  ink2: '#48422F',
  ink3: '#5A5446',
  ochre: '#8A5A14',
  line: 'rgba(31, 19, 0, 0.12)',
  lineStrong: 'rgba(31, 19, 0, 0.22)',
} as const;

// Static TTFs from @expo-google-fonts, loaded with expo-font. Body 500, medium 600, semibold 700.
export const fonts = {
  body: 'Inter_500Medium',
  medium: 'Inter_600SemiBold',
  semibold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_700Bold',
} as const;

export const radius = {
  card: 14,
  control: 10,
  small: 7,
} as const;
