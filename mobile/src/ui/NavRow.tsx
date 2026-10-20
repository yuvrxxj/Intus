import { useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { Row } from './kit';

/** A row in a group that pushes another screen: a symbol, the name, a line under it, and a chevron. */
export function NavRow({ title, note, symbol, href, first }: { title: string; note?: string; symbol: string; href: Href; first?: boolean }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} testID={`nav-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} onPress={() => router.push(href)}>
      <Row first={first} style={s.row}>
        <SymbolView name={symbol as never} tintColor={colors.red} size={22} style={s.icon} />
        <View style={s.text}>
          <Text style={s.title}>{title}</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
        </View>
        <SymbolView name={'chevron.right' as never} tintColor={colors.ink3} size={14} />
      </Row>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: 12 },
  icon: { width: 28, height: 28 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3 },
});
