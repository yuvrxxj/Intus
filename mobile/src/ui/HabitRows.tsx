import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { Habit } from '../../../src/db/rows.ts';
import { MAX_COUNT, describeGoal, fractionOfGoal, toneOf, type Entries, type HabitEntry } from '../../../src/features/habits/model.ts';
import { colors, fonts, radius } from '../theme/tokens';
import { Row, STACK_AT_FONT_SCALE } from './kit';

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toneColor = (tone: ReturnType<typeof toneOf>) => (tone === 'good' ? colors.green : tone === 'ok' ? colors.ochre : colors.ink);

/** Two buttons, Yes and No. Neither is lit until the person answers, and pressing the lit one again clears the answer. */
function YesNo({ name, slug, value, good, onChange }: { name: string; slug: string; value: boolean | null; good: boolean; onChange: (value: boolean | null) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={s.yesno}>
      {([true, false] as const).map((answer) => {
        const on = value === answer;
        return (
          <Pressable
            key={String(answer)}
            accessibilityRole="radio"
            accessibilityLabel={`${name}: ${answer ? 'yes' : 'no'}`}
            accessibilityState={{ selected: on }}
            testID={`habit-${slug}-${answer ? 'yes' : 'no'}`}
            onPress={() => onChange(on ? null : answer)}
            style={[s.choice, on && (good ? s.choiceGood : s.choiceNeutral)]}
          >
            <Text style={[s.choiceText, on && { color: '#FFFFFF' }]}>{answer ? 'Yes' : 'No'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One habit's check-in: a switch for yes or no, a stepper for a count, a number field for an amount. */
export function HabitRow({
  habit,
  entry,
  streak,
  onChange,
  first,
}: {
  habit: Habit;
  entry: HabitEntry | undefined;
  streak?: number;
  onChange: (entry: HabitEntry | null) => void;
  first?: boolean;
}) {
  const goal = describeGoal(habit);
  const tone = toneOf(habit, entry);
  const fraction = fractionOfGoal(habit, entry);
  const number = typeof entry?.value === 'number' ? entry.value : 0;
  const unit = habit.unit ?? '';
  // at the largest text sizes the name and the control no longer fit side by side, so the control drops below
  const stacked = useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;

  return (
    <Row first={first} style={[s.row, stacked && s.rowStacked]}>
      <View style={[s.text, stacked && s.textStacked]}>
        <Text style={s.name}>{habit.name}</Text>
        <Text style={s.hint}>
          {[goal, streak && streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} in a row` : null].filter(Boolean).join('  ·  ')}
        </Text>
        {fraction !== null ? (
          <View style={s.bar} accessibilityElementsHidden>
            <View style={[s.barFill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: toneColor(tone) }]} />
          </View>
        ) : null}
      </View>

      {habit.kind === 'yesno' ? (
        <YesNo
          name={habit.name}
          slug={slug(habit.name)}
          value={typeof entry?.value === 'boolean' ? entry.value : null}
          good={tone === 'good'}
          onChange={(v) => onChange(v === null ? null : { value: v })}
        />
      ) : habit.kind === 'count' ? (
        <View style={s.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Fewer ${habit.name}`}
            testID={`habit-${slug(habit.name)}-fewer`}
            disabled={number <= 0}
            hitSlop={4}
            onPress={() => onChange({ value: Math.max(0, number - 1) })}
            style={[s.step, number <= 0 && { opacity: 0.35 }]}
          >
            <Text style={s.stepText}>−</Text>
          </Pressable>
          <Text accessibilityLabel={`${habit.name}: ${number}`} style={[s.count, { color: toneColor(tone) }]}>
            {number}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More ${habit.name}`}
            testID={`habit-${slug(habit.name)}-more`}
            disabled={number >= MAX_COUNT}
            hitSlop={4}
            onPress={() => onChange({ value: Math.min(MAX_COUNT, number + 1) })}
            style={s.step}
          >
            <Text style={s.stepText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.amount}>
          <TextInput
            accessibilityLabel={unit ? `${habit.name}, ${unit}` : habit.name}
            testID={`habit-${slug(habit.name)}`}
            maxLength={6}
            selectTextOnFocus
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={(t) => {
              const clean = t.replace(',', '.').trim();
              if (clean === '') return onChange(null);
              const n = Number(clean);
              if (Number.isFinite(n) && n >= 0) onChange({ value: n });
            }}
            placeholder="0"
            placeholderTextColor={colors.ink3}
            style={[s.amountInput, { color: toneColor(tone) }]}
            textAlign="right"
            value={entry === undefined ? '' : String(number)}
          />
          {unit ? <Text style={s.unit}>{unit}</Text> : null}
        </View>
      )}
    </Row>
  );
}

export function HabitRows({
  habits,
  entries,
  streaks,
  onChange,
}: {
  habits: readonly Habit[];
  entries: Entries;
  streaks?: Record<string, number>;
  onChange: (id: string, entry: HabitEntry | null) => void;
}) {
  return (
    <>
      {habits.map((h, i) => (
        <HabitRow key={h.id} habit={h} entry={entries[h.id]} streak={streaks?.[h.id]} first={i === 0} onChange={(e) => onChange(h.id, e)} />
      ))}
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
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surface3, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  yesno: { flexDirection: 'row', gap: 6 },
  choice: { minWidth: 56, minHeight: 44, borderRadius: radius.control, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  choiceGood: { backgroundColor: colors.green },
  choiceNeutral: { backgroundColor: colors.ink2 },
  choiceText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.medium, fontSize: 22, color: colors.ink, marginTop: -2 },
  count: { fontFamily: fonts.monoSemibold, fontSize: 20, minWidth: 34, textAlign: 'center' },
  amount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountInput: { minWidth: 70, minHeight: 44, fontFamily: fonts.monoSemibold, fontSize: 20 },
  unit: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink3 },
});
