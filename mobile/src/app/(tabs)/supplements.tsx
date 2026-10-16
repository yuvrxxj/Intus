import { useMemo } from 'react';
import { Text } from 'react-native';
import { describeSchedule, dosesDue, dosesOf, normalizeDays, skippedToday } from '../../../../src/features/supplements/schedule.ts';
import { DoseRows } from '../../ui/DoseRows';
import { Group, Notice, PrimaryButton, Row, Screen } from '../../ui/kit';
import { useToday } from '../../today/TodayContext';
import { colors, fonts } from '../../theme/tokens';

export default function Supplements() {
  const t = useToday();
  const doses = useMemo(() => dosesDue(t.medications, t.date), [t.medications, t.date]);
  const skipped = useMemo(() => skippedToday(t.medications, t.date), [t.medications, t.date]);
  const taken = doses.filter((d) => t.draft.supplements[d.key] === true).length;

  return (
    <Screen title="Supplements" onRefresh={t.reload} refreshing={t.loading}>
      {t.loadError ? <Notice tone="ochre" text={`Today's saved entry could not be read, so saving is off. ${t.loadError}`} /> : null}
      {t.unsent ? <Notice tone="ochre" text="Not sent yet. Saved on your phone; it will go when you are back online." /> : null}
      {doses.length === 0 ? (
        <Notice text={t.loading ? 'Loading your supplements…' : 'Nothing due today. Add supplements on intus.fit and today\'s doses appear here.'} />
      ) : (
        <>
          <Group label={`${taken} of ${doses.length} taken`}>
            <DoseRows doses={doses} taken={t.draft.supplements} onChange={t.setSupplement} />
          </Group>
          <PrimaryButton testID="save-today" title={t.dirty || t.unsent ? 'Save today' : 'Saved'} onPress={t.save} busy={t.saving} disabled={!!t.loadError || t.loading || (!t.dirty && !t.unsent)} />
        </>
      )}
      {skipped.length > 0 ? (
        <Group label="Not today">
          {skipped.map((m, i) => (
            <Row key={m.id} first={i === 0}>
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink3 }}>
                {m.name}: {describeSchedule(dosesOf(m), normalizeDays(m.days_of_week))}
              </Text>
            </Row>
          ))}
        </Group>
      ) : null}
    </Screen>
  );
}
