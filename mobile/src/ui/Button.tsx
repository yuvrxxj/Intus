import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { color, font } from '../theme/tokens';

/** `red` is the one Swiss-red action on a screen. Every other button is quiet. */
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
  const off = !!busy || !!disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={[styles.base, red ? styles.red : styles.quiet, off && styles.busy]}
    >
      {busy ? (
        <ActivityIndicator color={red ? color.paper : color.ink} />
      ) : (
        <Text style={[styles.text, red ? styles.textOnRed : styles.textQuiet]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  red: { backgroundColor: color.red },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
  busy: { opacity: 0.6 },
  text: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
  textOnRed: { color: color.paper },
  textQuiet: { color: color.ink },
});
