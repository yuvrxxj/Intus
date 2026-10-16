import { StyleSheet, Switch, Text, View } from 'react-native';
import type { Dose } from '../../../src/features/supplements/schedule.ts';
import { describeSchedule } from '../../../src/features/supplements/schedule.ts';
import { colors, fonts } from '../theme/tokens';
import { Row } from './kit';

/** The supplements due today, one row per dose, ticked into the day's log. */
export function DoseRows({ doses, taken, onChange }: { doses: readonly Dose[]; taken: Record<string, boolean>; onChange: (key: string, taken: boolean) => void }) {
  return (
    <>
      {doses.map((d, i) => {
        const title = d.of > 1 ? `${d.name}, dose ${d.n} of ${d.of}` : d.name;
        return (
          <Row key={d.key} first={i === 0} style={s.row}>
            <View style={s.text}>
              <Text style={s.name}>{title}</Text>
              <Text style={s.hint}>{[d.dosage, describeSchedule(d.of, d.days)].filter(Boolean).join('  ·  ')}</Text>
            </View>
            <Switch accessibilityLabel={title} testID={`dose-${d.key}`} onValueChange={(v) => onChange(d.key, v)} trackColor={{ true: colors.green }} value={taken[d.key] === true} />
          </Row>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  row: { justifyContent: 'space-between', paddingVertical: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  hint: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
});
