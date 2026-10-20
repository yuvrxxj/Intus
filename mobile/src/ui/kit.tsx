import { Keyboard, Pressable, useWindowDimensions, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { colors, fonts, radius } from '../theme/tokens';

/** Number pads have no return key, so a Done bar rides just above the keyboard whenever it is up. */
function DoneBar() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (height === 0) return null;
  return (
    <View style={[s.doneBar, { bottom: height }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Done" testID="keyboard-done" hitSlop={8} onPress={Keyboard.dismiss} style={s.doneButton}>
        <Text style={s.textButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}

/** A scrolling page under the system large title: the paper background, pull to refresh, and room under the tab bar. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  // the scroll view stays the screen's first child, so the system large title can follow it as it scrolls
  return (
    <>
      <ScrollView
        style={s.screen}
        contentContainerStyle={s.screenContent}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink3} /> : undefined}
      >
        {children}
      </ScrollView>
      <DoneBar />
    </>
  );
}

/** A grouped inset section: a small label above, the rows in one rounded surface, a note below. */
export function Group({ label, note, children }: { label?: string; note?: string; children: ReactNode }) {
  return (
    <View style={s.group}>
      {label ? <Text style={s.groupLabel}>{label}</Text> : null}
      <View style={s.groupBody}>{children}</View>
      {note ? <Text style={s.groupNote}>{note}</Text> : null}
    </View>
  );
}

/** One row in a group. A hairline separates it from the one above unless it is first. */
export function Row({ children, first, style }: { children: ReactNode; first?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, !first && s.rowDivider, style]}>{children}</View>;
}

/** At the largest text sizes a label, a number and a unit no longer fit on one line, so the row stacks. */
export const STACK_AT_FONT_SCALE = 1.5;

export function Field({
  label,
  unit,
  first,
  ...input
}: { label: string; unit?: string; first?: boolean } & Omit<TextInputProps, 'style'>) {
  const stacked = useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
  return (
    <Row first={first} style={stacked ? s.fieldStacked : s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={stacked ? s.fieldEntryStacked : s.fieldEntry}>
        <TextInput
          accessibilityLabel={unit ? `${label}, ${unit}` : label}
          placeholderTextColor={colors.ink3}
          selectTextOnFocus
          style={s.fieldInput}
          textAlign={stacked ? 'left' : 'right'}
          {...input}
        />
        {unit ? <Text style={s.fieldUnit}>{unit}</Text> : null}
      </View>
    </Row>
  );
}

/** The system prominent button, in the red tint. At least 44 pt tall. */
export function PrimaryButton({ title, onPress, disabled, busy, testID }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; testID?: string }) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.primary, off && s.primaryOff, pressed && { opacity: 0.85 }]}
    >
      <Text style={s.primaryText}>{busy ? 'Saving…' : title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress, tone = 'red', testID }: { title: string; onPress: () => void; tone?: 'red' | 'ink'; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} testID={testID} onPress={onPress} hitSlop={8} style={s.textButton}>
      <Text style={[s.textButtonText, tone === 'ink' && { color: colors.ink3 }]}>{title}</Text>
    </Pressable>
  );
}

/** A plain statement in the page: loading, empty, an error. */
export function Notice({ text, tone = 'ink' }: { text: string; tone?: 'ink' | 'ochre' | 'red' }) {
  const color = tone === 'ochre' ? colors.ochre : tone === 'red' ? colors.red : colors.ink3;
  return <Text style={[s.notice, { color }]}>{text}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8, gap: 20 },
  group: { gap: 6 },
  groupLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.8, color: colors.ink3, textTransform: 'uppercase', paddingHorizontal: 16 },
  groupBody: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  groupNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3, paddingHorizontal: 16 },
  row: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  fieldRow: { justifyContent: 'space-between' },
  fieldStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 2 },
  fieldEntry: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldEntryStacked: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 17, color: colors.ink, flexShrink: 0 },
  fieldInput: { flex: 1, minWidth: 80, minHeight: 44, fontFamily: fonts.mono, fontSize: 17, color: colors.ink, paddingVertical: 0 },
  fieldUnit: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink3, minWidth: 30 },
  primary: { minHeight: 50, borderRadius: radius.card, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryOff: { opacity: 0.4 },
  primaryText: { fontFamily: fonts.medium, fontSize: 17, color: '#FFFFFF' },
  doneBar: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, alignItems: 'flex-end', paddingHorizontal: 16 },
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  textButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.red },
  notice: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, paddingHorizontal: 4 },
});
