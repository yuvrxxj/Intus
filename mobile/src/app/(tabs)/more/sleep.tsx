import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { bandSentence, CLASS_LABEL, classifyHours } from '../../../../../src/features/sleep/ageBand.ts';
import { approx, clockRange, nightHeading, sourceLabel } from '../../../../../src/features/sleep/format.ts';
import { MIN_NIGHTS, summarize } from '../../../../../src/features/sleep/summary.ts';
import { formatClock, formatDuration, roundTo5 } from '../../../../../src/features/sleep/time.ts';
import { todayKey } from '../../../../../src/util/dates.ts';
import { deleteSleep } from '../../../data/sleep';
import { useSleep } from '../../../sleep/useSleep';
import { colors, fonts } from '../../../theme/tokens';
import { Group, Notice, PrimaryButton, Row, Screen, TextButton } from '../../../ui/kit';

const WINDOW = 28;
const SHOWN = 14;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Row style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.statValue}>
        <Text style={s.statText}>{value}</Text>
        {note ? <Text style={s.statNote}>{note}</Text> : null}
      </View>
    </Row>
  );
}

export default function Sleep() {
  const sleep = useSleep();
  const router = useRouter();
  const today = todayKey();

  const summary = useMemo(() => summarize(sleep.built.nights, today, WINDOW), [sleep.built.nights, today]);
  const recent = useMemo(() => [...sleep.built.nights].sort((a, b) => b.key.localeCompare(a.key)).slice(0, SHOWN), [sleep.built.nights]);

  function confirmDelete(id: string, heading: string) {
    Alert.alert('Delete this night?', `${heading} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteSleep(id).then(sleep.reload, (e: unknown) => Alert.alert('Could not delete', e instanceof Error ? e.message : String(e))),
      },
    ]);
  }

  return (
    <Screen onRefresh={sleep.reload} refreshing={sleep.status === 'loading'}>
      {sleep.status === 'error' ? <Notice tone="red" text={`Your sleep could not be loaded. ${sleep.error ?? ''} Pull down to try again.`} /> : null}
      {sleep.unsentIds.size > 0 ? (
        <Notice tone="ochre" text={`Not sent yet. ${sleep.unsentIds.size === 1 ? 'One night is' : `${sleep.unsentIds.size} nights are`} saved on your phone and will go when you are back online.${sleep.sendError ? ` (${sleep.sendError})` : ''}`} />
      ) : null}

      <PrimaryButton title="Add a night" testID="sleep-add" onPress={() => router.push('/more/sleep-entry')} />

      <Group label={`The last ${WINDOW} days`} note={summary.enough ? `Based on ${summary.nights} night${summary.nights === 1 ? '' : 's'}.${summary.rough ? ' Under 14 nights, so the spread is only rough.' : ''}` : undefined}>
        {summary.enough && summary.medianAsleepMin !== null ? (
          <>
            <Stat label="Median time asleep" value={formatDuration(roundTo5(summary.medianAsleepMin))} />
            {summary.usualAsleepClock !== null ? <Stat label="Usually asleep by" value={formatClock(summary.usualAsleepClock)} note={summary.asleepSdMin !== null ? `varies by about ${roundTo5(summary.asleepSdMin)} min` : undefined} /> : null}
            {summary.usualWakeClock !== null ? <Stat label="Usually up at" value={formatClock(summary.usualWakeClock)} note={summary.wakeSdMin !== null ? `varies by about ${roundTo5(summary.wakeSdMin)} min` : undefined} /> : null}
          </>
        ) : (
          <Row first>
            <Text style={s.empty}>
              {sleep.status === 'loading'
                ? 'Loading…'
                : `${summary.nights} night${summary.nights === 1 ? '' : 's'} so far. Averages show after ${MIN_NIGHTS}, so nothing small is dressed up as a pattern.`}
            </Text>
          </Row>
        )}
      </Group>
      {sleep.band ? <Text style={s.band}>{bandSentence(sleep.band)} A range for healthy people, not a target.</Text> : null}

      <Group label="Recent nights">
        {recent.length === 0 ? (
          <Row first>
            <Text style={s.empty}>{sleep.status === 'loading' ? 'Loading…' : 'No nights yet. Add one, or connect Apple Health under More.'}</Text>
          </Row>
        ) : (
          recent.map((night, i) => {
            const { main } = night;
            const m = main.metrics;
            const device = main.session.sourceKind !== 'manual';
            const duration = formatDuration(m.tstMin);
            const hours = (sleep.band?.includesNaps ? night.totalAsleep24Min : m.tstMin) / 60;
            const unsent = main.session.members.some((id) => sleep.unsentIds.has(id)) || sleep.unsentIds.has(main.session.id);
            return (
              <Row key={night.key} first={i === 0} style={s.night}>
                <View style={s.nightTop}>
                  <Text style={s.nightHeading}>{nightHeading(night.key)}</Text>
                  <Text style={s.nightDuration}>{device ? approx(duration) : duration}</Text>
                </View>
                <Text style={s.nightMeta}>
                  {clockRange(main.session)} · {sourceLabel(main.session)}
                </Text>
                {sleep.band ? <Text style={s.nightClass}>{CLASS_LABEL[classifyHours(hours, sleep.band)]}</Text> : null}
                {unsent ? <Text style={s.nightUnsent}>Not sent yet</Text> : null}
                {main.session.sourceKind === 'manual' && !unsent ? (
                  <TextButton title="Delete" tone="ink" onPress={() => confirmDelete(main.session.id, nightHeading(night.key))} />
                ) : null}
              </Row>
            );
          })
        )}
      </Group>
    </Screen>
  );
}

const s = StyleSheet.create({
  stat: { justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: { fontFamily: fonts.body, fontSize: 17, color: colors.ink, flexShrink: 1 },
  statValue: { alignItems: 'flex-end' },
  statText: { fontFamily: fonts.monoSemibold, fontSize: 17, color: colors.ink },
  statNote: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  empty: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink3, flex: 1 },
  band: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3, paddingHorizontal: 4 },
  night: { flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingVertical: 12 },
  nightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  nightHeading: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, flexShrink: 1 },
  nightDuration: { fontFamily: fonts.monoSemibold, fontSize: 17, color: colors.ink },
  nightMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  nightClass: { fontFamily: fonts.body, fontSize: 13, color: colors.ink2 },
  nightUnsent: { fontFamily: fonts.body, fontSize: 13, color: colors.ochre },
});
