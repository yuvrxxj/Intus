// Intus colours and type, the same values as src/styles/index.css. Screens use these and nothing else.
// Swiss red is for one action on a screen. Paper is the background.

export const color = {
  paper: '#E5ECE9',
  surface: '#F2F5F3',
  surface2: '#FBFCFB',
  surface3: '#E9EEEB',
  ink: '#1F1300',
  ink2: '#48422F',
  ink3: '#5A5446',
  red: '#A31621',
  /** The error notice ground. A solid tint, not a translucent red. */
  redTint: '#F0DFDF',
  green: '#12695F',
  ochre: '#8A5A14',
  line: 'rgba(31, 19, 0, 0.12)',
  lineStrong: 'rgba(31, 19, 0, 0.22)',
} as const;

/** Same object. Older screens import this name. */
export const C = color;

/**
 * Static faces. The web uses a variable Inter at 650 for headings; the phone ships 600, the nearest cut.
 * Body is 500.
 */
export const font = {
  body: 'Inter_500Medium',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/**
 * Type scale: large title 34/41, title 28/34, body 15/22. Line height is left unset so the largest
 * accessibility size can wrap and grow instead of clipping.
 */
export const type = {
  largeTitle: { fontFamily: font.bold, fontSize: 34 },
  title: { fontFamily: font.medium, fontSize: 28 },
  body: { fontFamily: font.body, fontSize: 15 },
  heading: { fontFamily: font.medium, fontSize: 15 },
} as const;
