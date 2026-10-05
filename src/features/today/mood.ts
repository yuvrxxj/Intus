/** Mood is a 1 to 5 scale. Each step has a word, shown instead of a face. */
export const MOODS = [
  { value: 1, word: 'Rough' },
  { value: 2, word: 'Low' },
  { value: 3, word: 'Okay' },
  { value: 4, word: 'Good' },
  { value: 5, word: 'Great' },
] as const;

export function moodWord(value: number | null | undefined): string {
  return MOODS.find((m) => m.value === value)?.word ?? '';
}
