import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font } from '../theme/tokens';

/**
 * `red` is the one filled action on a screen. Disabled is never red: surface-3 fill and ink-3 text.
 * PR #48's Button takes the same `tone` and still fades a disabled red button with opacity; that
 * branch is adding this fill. Busy keeps the label and puts a spinner beside it.
 */
export function Button({
  label,
  onPress,
  busy,
  disabled,
  tone,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone: 'red' | 'quiet';
  accessibilityLabel?: string;
}) {
  const red = tone === 'red';
  const faded = !!disabled;
  const ink = faded ? color.ink3 : red ? color.paper : color.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: faded || !!busy, busy: !!busy }}
      onPress={onPress}
      disabled={faded || !!busy}
      style={[styles.base, red && !faded && styles.red, !red && !faded && styles.quiet, faded && styles.disabled]}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={ink} /> : null}
        <Text style={[styles.text, { color: ink }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  red: { backgroundColor: color.red },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
  disabled: { backgroundColor: color.surface3, borderWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontFamily: font.medium, fontSize: 15, textAlign: 'center', flexShrink: 1 },
});
