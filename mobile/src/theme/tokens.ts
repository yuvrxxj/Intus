// Intus colours and type, the same values as src/styles/index.css. Screens use these and nothing else.
// Swiss red is for one action on a screen. Paper is the background. Ochre is "check this", never a second red.

export const color = {
  paper: '#E5ECE9',
  surface: '#F2F5F3',
  ink: '#1F1300',
  ink2: '#48422F',
  ink3: '#5A5446',
  red: '#A31621',
  green: '#12695F',
  ochre: '#8A5A14',
  line: 'rgba(31, 19, 0, 0.12)',
  lineStrong: 'rgba(31, 19, 0, 0.22)',
} as const;

/** Loaded from @expo-google-fonts. Weights match the web: body 500, medium 600, semibold 700. */
export const font = {
  body: 'Inter_500Medium',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
