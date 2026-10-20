import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { greeting, homeLine } from '../today/summary';
import { useToday } from '../today/TodayContext';
import { colors, fonts } from '../theme/tokens';
import { Bust } from '../ui/Bust';
import { PrimaryButton } from '../ui/kit';

// The welcome screen: the app opens here. The picture, a greeting, one line about today, and the way into the log.
export default function Home() {
  const t = useToday();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const bustHeight = Math.min(360, Math.max(220, height * 0.4));

  return (
    <View style={[s.screen, { paddingTop: insets.top + 24 }]}>
      <Text accessibilityRole="header" style={s.brand}>
        INTUS
      </Text>
      <View style={s.art}>
        <Bust height={bustHeight} />
      </View>
      <View style={s.copy}>
        <Text style={s.greeting}>{greeting(new Date().getHours())}</Text>
        <Text style={s.line}>{homeLine(t.draft, t.habits, t.loading)}</Text>
        {t.unsent ? <Text style={s.unsent}>Not sent yet. Saved on your phone.</Text> : null}
      </View>
      <View style={s.action}>
        <PrimaryButton title="Log today" onPress={() => router.navigate('/today')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24, paddingBottom: 120 },
  brand: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 3, color: colors.red },
  art: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  copy: { gap: 6, paddingTop: 24, paddingBottom: 20 },
  greeting: { fontFamily: fonts.semibold, fontSize: 34, letterSpacing: -0.8, color: colors.ink },
  line: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink3 },
  unsent: { fontFamily: fonts.body, fontSize: 15, color: colors.ochre },
  action: {},
});
