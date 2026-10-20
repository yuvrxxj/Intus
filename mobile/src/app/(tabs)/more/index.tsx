import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../../theme/tokens';
import { Group, Screen } from '../../../ui/kit';
import { NavRow } from '../../../ui/NavRow';

export default function More() {
  return (
    <Screen>
      <Group>
        <NavRow first symbol="pills" title="Supplements" note="What is due today" href="/more/supplements" />
        <NavRow symbol="heart.text.square" title="Apple Health" note="Sleep and heart readings" href="/more/health" />
        <NavRow symbol="person.crop.circle" title="Account" note="Sign out, download your data, delete" href="/more/account" />
      </Group>
      <Text style={s.disclaimer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  disclaimer: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.6, color: colors.ink3, textAlign: 'center', textTransform: 'uppercase' },
});
