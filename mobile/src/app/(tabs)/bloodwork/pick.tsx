import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useBloodwork } from '../../../bloodwork/useBloodwork';
import { colors, fonts } from '../../../theme/tokens';
import { Group, Notice, Row, Screen } from '../../../ui/kit';

const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

export default function Pick() {
  const bw = useBloodwork();
  const router = useRouter();
  if (bw.status !== 'ready') return <Screen>{bw.status === 'error' ? <Notice tone="red" text={bw.message} /> : <Notice text="Loading the markers…" />}</Screen>;

  const categories = [...new Set(bw.biomarkers.map((b) => b.category))];
  return (
    <Screen>
      {categories.map((category) => (
        <Group key={category} label={label(category)}>
          {bw.biomarkers
            .filter((b) => b.category === category)
            .map((b, i) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.name}, ${b.unit}`} testID={`pick-${b.code}`} onPress={() => router.navigate({ pathname: '/bloodwork/add', params: { marker: b.id } })}>
                <Row first={i === 0} style={s.row}>
                  <Text style={s.name}>{b.name}</Text>
                  <Text style={s.unit}>{b.unit}</Text>
                </Row>
              </Pressable>
            ))}
        </Group>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { justifyContent: 'space-between' },
  name: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  unit: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink3 },
});
