import { StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import type { Dose } from '../../../src/features/supplements/schedule.ts';
import { describeSchedule } from '../../../src/features/supplements/schedule.ts';
import { colors, fonts } from '../theme/tokens';
import { Row, STACK_AT_FONT_SCALE } from './kit';

/** The supplements due today, one row per dose, ticked into the day's log. */
export function DoseRows({ doses, taken, onChange }: { doses: readonly Dose[]; taken: Record<string, boolean>; onChange: (key: string, taken: boolean) => void }) {
  const stacked = useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
  return (
    <>
      {doses.map((d, i) => {
        const title = d.of > 1 ? `${d.name}, dose ${d.n} of ${d.of}` : d.name;
        return (
          <Row key={d.key} first={i === 0} style={[s.row, stacked && s.rowStacked]}>
            <View style={[s.text, stacked && s.textStacked]}>
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
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  text: { flex: 1, gap: 2 },
  textStacked: { flex: 0, alignSelf: 'stretch' },
  name: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  hint: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
});
