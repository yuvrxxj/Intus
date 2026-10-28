// Intus colours and type, the same values as src/styles/index.css. Screens use these and nothing else.
// Swiss red is for one action on a screen. Paper is the background. Ochre is "check this", never a second red.

export const color = {
  paper: '#E5ECE9',
  surface: '#F2F5F3',
  surface2: '#FBFCFB',
  /** disabled controls, the same step as --surface-3 on the web */
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
 * Static faces from the bundled fonts. Headings are Inter 600, the nearest cut to 650
 * (the package has no 650). Body stays Inter 500. `medium` is that same 600 face.
 */
export const font = {
  body: 'Inter_500Medium',
  heading: 'Inter_600SemiBold',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/**
 * Type scale, written as size/line-height on the web: large title 34/41, title 28/34, body 15/22.
 * Only the size is applied. A fixed line height clips when the system text size grows.
 */
export const type = {
  largeTitle: 34,
  title: 28,
  body: 15,
} as const;
