import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
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
  const measured = useRef(0);
  const [locked, setLocked] = useState<number | null>(null);
  useEffect(() => {
    setLocked(busy && measured.current > 0 ? measured.current : null);
  }, [busy]);

  const off = !!disabled;
  const red = tone === 'red' && !off;
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
      <Text style={[styles.text, off ? styles.textDisabled : red ? styles.textOnRed : styles.textQuiet]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  red: { backgroundColor: color.red },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
  disabled: { backgroundColor: color.surface3 },
  text: { fontFamily: font.bold, fontSize: 16 },
  textOnRed: { color: color.paper },
  textQuiet: { color: color.ink },
  textDisabled: { color: color.ink3 },
});
