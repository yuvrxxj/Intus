import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from './theme/tokens';

/** One filled red button is the screen's action. Quiet is an ordinary button. Danger is the destructive one, red text, not a second fill. */
export function Button({
  label,
  onPress,
  busy,
  quiet,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  quiet?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const off = !!busy || !!disabled;
  const ink = danger ? C.red : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={[styles.button, quiet && styles.quiet, danger && styles.danger, off && { opacity: busy ? 0.6 : 0.45 }]}
    >
      <View style={styles.row}>
        {busy && <ActivityIndicator color={quiet || danger ? ink : C.paper} />}
        <Text style={[styles.buttonText, (quiet || danger) && { color: ink }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export const screen = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  wrap: { flex: 1, padding: 20, gap: 14 },
  scroll: { flexGrow: 1, padding: 20, gap: 14 },
  brand: { fontFamily: 'Menlo', fontSize: 12, letterSpacing: 2, color: C.red, marginTop: 8, marginBottom: 6 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 18, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  label: { fontFamily: 'Menlo', fontSize: 11, letterSpacing: 1, color: C.ink3, textTransform: 'uppercase' },
  body: { fontSize: 15, lineHeight: 21, color: C.ink, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 18, color: C.ink3 },
  input: {
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderRadius: 10,
    padding: 12,
    minHeight: 44,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.surface2,
  },
  error: { color: C.red, fontSize: 14, fontWeight: '600' },
  detail: { fontFamily: 'Menlo', fontSize: 11, lineHeight: 16, color: C.ink3 },
  footer: { marginTop: 'auto', fontFamily: 'Menlo', fontSize: 10, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase', textAlign: 'center' },
  phrase: { fontFamily: 'Menlo', color: C.ink },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '600', color: C.ink, textDecorationLine: 'underline' },
  row: { gap: 8 },
});

const styles = StyleSheet.create({
  button: { backgroundColor: C.red, borderRadius: 10, minHeight: 44, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red },
  buttonText: { color: C.paper, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
