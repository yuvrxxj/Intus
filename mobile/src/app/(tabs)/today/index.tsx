import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activeHabits } from '../../../../../src/features/habits/model.ts';
import { dosesDue } from '../../../../../src/features/supplements/schedule.ts';
import { MOODS } from '../../../../../src/features/today/mood.ts';
import { DoseRows } from '../../../ui/DoseRows';
import { HabitRows } from '../../../ui/HabitRows';
import { Field, Group, Notice, PrimaryButton, Row, Screen } from '../../../ui/kit';
import { useToday } from '../../../today/TodayContext';
import { saveLabel } from '../../../today/summary';
import { streaksFor } from '../../../today/streaks';
import { colors, fonts, radius } from '../../../theme/tokens';

export default function Today() {
  const t = useToday();
  const habits = useMemo(() => activeHabits(t.habits), [t.habits]);
  const doses = useMemo(() => dosesDue(t.medications, t.date), [t.medications, t.date]);
  const streaks = useMemo(() => streaksFor(habits, t.recent, t.draft.habits, t.date), [habits, t.recent, t.draft.habits, t.date]);
  const d = t.draft;

  return (
    <Screen onRefresh={t.reload} refreshing={t.loading}>
      {t.loadError ? (
        <Notice tone="ochre" text={`Today's saved entry could not be read, so saving is off to protect it. ${t.loadError} Pull down to try again.`} />
      ) : null}
      {t.unsent ? (
        <Notice tone="ochre" text={`Not sent yet. This entry is saved on your phone and will go when you are back online.${t.sendError ? ` (${t.sendError})` : ''}`} />
      ) : null}

      <Group label="Body and food">
        <Field first testID="weight" maxLength={6} label="Weight" unit="kg" value={d.weight} onChangeText={(v) => t.set('weight', v)} inputMode="decimal" keyboardType="decimal-pad" placeholder="0" />
        <Field testID="calories" maxLength={5} label="Calories" unit="kcal" value={d.calories} onChangeText={(v) => t.set('calories', v.replace(/\D/g, ''))} inputMode="numeric" keyboardType="number-pad" placeholder="0" />
        <Field testID="protein" maxLength={4} label="Protein" unit="g" value={d.protein} onChangeText={(v) => t.set('protein', v.replace(/\D/g, ''))} inputMode="numeric" keyboardType="number-pad" placeholder="0" />
        <Field testID="carbs" maxLength={4} label="Carbs" unit="g" value={d.carbs} onChangeText={(v) => t.set('carbs', v.replace(/\D/g, ''))} inputMode="numeric" keyboardType="number-pad" placeholder="0" />
        <Field testID="fat" maxLength={4} label="Fat" unit="g" value={d.fat} onChangeText={(v) => t.set('fat', v.replace(/\D/g, ''))} inputMode="numeric" keyboardType="number-pad" placeholder="0" />
      </Group>

      <Group label="Mood">
        <Row first style={s.moods}>
          {MOODS.map((m) => {
            const on = d.mood === m.value;
            return (
              <Pressable
                key={m.value}
                testID={`mood-${m.value}`}
                accessibilityRole="button"
                accessibilityLabel={`Mood ${m.value} of 5, ${m.word}`}
                accessibilityState={{ selected: on }}
                onPress={() => t.set('mood', on ? null : m.value)}
                style={[s.mood, on && s.moodOn]}
              >
                <Text style={[s.moodText, on && { color: '#FFFFFF' }]}>{m.word}</Text>
              </Pressable>
            );
          })}
        </Row>
        <Field label="Notes" placeholder="Anything to remember" value={d.notes} onChangeText={(v) => t.set('notes', v)} maxLength={500} />
      </Group>

      {habits.length > 0 ? (
        <Group label="Habits">
          <HabitRows habits={habits} entries={d.habits} streaks={streaks} onChange={t.setHabit} />
        </Group>
      ) : null}

      {doses.length > 0 ? (
        <Group label="Supplements due today">
          <DoseRows doses={doses} taken={d.supplements} onChange={t.setSupplement} />
        </Group>
      ) : null}

      <PrimaryButton testID="save-today" title={saveLabel(t.draft, t.dirty, t.unsent)} onPress={t.save} busy={t.saving} disabled={!!t.loadError || t.loading || (!t.dirty && !t.unsent)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  moods: { gap: 6, paddingVertical: 8 },
  mood: { flex: 1, minHeight: 44, borderRadius: radius.control, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  moodOn: { backgroundColor: colors.red },
  moodText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
});
