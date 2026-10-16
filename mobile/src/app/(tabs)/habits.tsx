import { useMemo } from 'react';
import { activeHabits, summarize } from '../../../../src/features/habits/model.ts';
import { HabitRows } from '../../ui/HabitRows';
import { Group, Notice, PrimaryButton, Screen } from '../../ui/kit';
import { useToday } from '../../today/TodayContext';
import { streaksFor } from '../../today/streaks';

export default function Habits() {
  const t = useToday();
  const habits = useMemo(() => activeHabits(t.habits), [t.habits]);
  const streaks = useMemo(() => streaksFor(habits, t.recent, t.draft.habits, t.date), [habits, t.recent, t.draft.habits, t.date]);
  const { onTrack, total } = summarize(t.habits, t.draft.habits);

  return (
    <Screen title="Habits" onRefresh={t.reload} refreshing={t.loading}>
      {t.loadError ? <Notice tone="ochre" text={`Today's saved entry could not be read, so saving is off. ${t.loadError}`} /> : null}
      {t.unsent ? <Notice tone="ochre" text="Not sent yet. Saved on your phone; it will go when you are back online." /> : null}
      {habits.length === 0 ? (
        <Notice text={t.loading ? 'Loading your habits…' : 'No habits yet. Add them on intus.fit and they appear here.'} />
      ) : (
        <>
          <Group label={`${onTrack} of ${total} on track today`} note="A streak counts the days in a row you were on track.">
            <HabitRows habits={habits} entries={t.draft.habits} streaks={streaks} onChange={t.setHabit} />
          </Group>
          <PrimaryButton testID="save-today" title={t.dirty || t.unsent ? 'Save today' : 'Saved'} onPress={t.save} busy={t.saving} disabled={!!t.loadError || t.loading || (!t.dirty && !t.unsent)} />
        </>
      )}
    </Screen>
  );
}
