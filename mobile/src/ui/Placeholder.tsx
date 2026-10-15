import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

// Stands in for a screen that is not built yet, and says so plainly.
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <View style={s.screen}>
      <View style={s.card}>
        <Text style={s.label}>Not built yet</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.body}>{note}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 10 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: colors.ink3, textTransform: 'uppercase' },
  title: { fontFamily: fonts.semibold, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
});
