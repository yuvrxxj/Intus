import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font } from '../theme/tokens';

const SPIN = ['|', '/', '-', '\\'] as const;
const SPIN_DELAY_MS = 400;
const SPIN_STEP_MS = 120;

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
  const measured = useRef(0);
  const [locked, setLocked] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [showSpin, setShowSpin] = useState(false);
  useEffect(() => {
    if (!busy) {
      setLocked(null);
      setShowSpin(false);
      setTick(0);
      return;
    }
    setLocked(measured.current > 0 ? measured.current : null);
    const appear = setTimeout(() => setShowSpin(true), SPIN_DELAY_MS);
    const step = setInterval(() => setTick((n) => (n + 1) % SPIN.length), SPIN_STEP_MS);
    return () => {
      clearTimeout(appear);
      clearInterval(step);
    };
  }, [busy]);

  const off = !!disabled;
  const red = tone === 'red' && !off;
  const ink = [styles.text, off ? styles.textDisabled : red ? styles.textOnRed : styles.textQuiet];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off || !!busy, busy: !!busy }}
      onPress={onPress}
      disabled={off || !!busy}
      onLayout={(event) => {
        if (!busy) measured.current = event.nativeEvent.layout.width;
      }}
      style={[styles.base, off ? styles.disabled : red ? styles.red : styles.quiet, locked != null && { width: locked }]}
    >
      <View style={styles.row}>
        <Text style={ink}>{label}</Text>
        {showSpin ? <Text accessible={false} importantForAccessibility="no" style={[ink, styles.spin]}>{SPIN[tick]}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  red: { backgroundColor: color.red },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
  disabled: { backgroundColor: color.surface3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontFamily: font.bold, fontSize: 16 },
  spin: { fontFamily: font.mono, fontSize: 14, width: 12, textAlign: 'center' },
  textOnRed: { color: color.paper },
  textQuiet: { color: color.ink },
  textDisabled: { color: color.ink3 },
});
