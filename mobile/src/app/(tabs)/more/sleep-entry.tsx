import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { validateSleepForm, type SleepErrors } from '../../../../../src/features/sleep/model.ts';
import { dayLabel } from '../../../../../src/features/sleep/format.ts';
import { dayNumber, isoDay } from '../../../../../src/lib/dates.ts';
import { todayKey } from '../../../../../src/util/dates.ts';
import { flushBucket, queueIn } from '../../../data/outbox';
import { sendSleep, type PendingSleep } from '../../../data/sleep';
import { outboxStore } from '../../../data/storage';
import { useAuth } from '../../../auth/AuthContext';
import { phoneResolver, sleepForm } from '../../../sleep/entry';
import { uuid } from '../../../util/uuid';
import { SLEEP_BUCKET, useSleep } from '../../../sleep/useSleep';
import { colors, fonts } from '../../../theme/tokens';
import { Field, Group, Notice, PrimaryButton, Row, Screen } from '../../../ui/kit';

const MAX_DAYS_BACK = 60;

function dayName(daysBack: number): string {
  if (daysBack === 0) return 'Today';
  if (daysBack === 1) return 'Yesterday';
  return dayLabel(isoDay(dayNumber(todayKey()) - daysBack));
}

export default function SleepEntry() {
  const { session } = useAuth();
  const router = useRouter();
  const sleep = useSleep();
  const [daysBack, setDaysBack] = useState(0);
  const [bed, setBed] = useState('');
  const [wake, setWake] = useState('');
  const [latency, setLatency] = useState('');
  const [awake, setAwake] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<SleepErrors>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const wakeDate = isoDay(dayNumber(todayKey()) - daysBack);

  async function save() {
    const userId = session?.user.id;
    if (!userId) return;
    const form = sleepForm({ wakeDate, bed, wake, latency, awake, notes });
    const result = validateSleepForm(form, {
      nowMs: Date.now(),
      resolve: phoneResolver,
      tzId: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      existing: sleep.sessions,
    });
    if (!result.ok) {
      setErrors(result.errors);
      setWarnings([]);
      return;
    }
    // a warning (more than 14 hours in bed) is shown once, and the same press again saves
    if (result.warnings.length > 0 && warnings.join() !== result.warnings.join()) {
      setErrors({});
      setWarnings(result.warnings);
      return;
    }
    setErrors({});
    setSaving(true);
    setFailure(null);
    try {
      const entry: PendingSleep = { id: uuid(), values: result.value, queuedAt: new Date().toISOString() };
      // on the phone first, then sent: a closed app or a lost connection never loses the night
      await queueIn(outboxStore, SLEEP_BUCKET, userId, entry.id, entry);
      const flushed = await flushBucket<PendingSleep>(outboxStore, SLEEP_BUCKET, userId, sendSleep);
      if (flushed.failed > 0) setFailure(flushed.error);
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Group label="Night ending" note="The morning you got up.">
        <Row first style={s.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="Earlier day" testID="sleep-earlier" disabled={daysBack >= MAX_DAYS_BACK} hitSlop={6} onPress={() => setDaysBack(daysBack + 1)} style={s.step}>
            <Text style={s.stepText}>‹</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={s.day}>
            {dayName(daysBack)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Later day" testID="sleep-later" disabled={daysBack === 0} hitSlop={6} onPress={() => setDaysBack(daysBack - 1)} style={[s.step, daysBack === 0 && { opacity: 0.35 }]}>
            <Text style={s.stepText}>›</Text>
          </Pressable>
        </Row>
      </Group>

      <Group label="Times" note="24 hour clock, like 23:00 and 07:00.">
        <Field first testID="sleep-bed" label="Got into bed" placeholder="23:00" value={bed} onChangeText={setBed} keyboardType="numbers-and-punctuation" maxLength={5} autoCorrect={false} />
        <Field testID="sleep-wake" label="Got up" placeholder="07:00" value={wake} onChangeText={setWake} keyboardType="numbers-and-punctuation" maxLength={5} autoCorrect={false} />
      </Group>
      {errors.start ? <Notice tone="red" text={errors.start} /> : null}
      {errors.end ? <Notice tone="red" text={errors.end} /> : null}

      <Group label="Optional" note="Your own estimates, in whole minutes.">
        <Field first testID="sleep-latency" label="To fall asleep" unit="min" placeholder="0" value={latency} onChangeText={(v) => setLatency(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
        <Field testID="sleep-awake" label="Awake in the night" unit="min" placeholder="0" value={awake} onChangeText={(v) => setAwake(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
        <Field testID="sleep-notes" label="Note" placeholder="Anything to remember" value={notes} onChangeText={setNotes} maxLength={200} />
      </Group>
      {errors.latency ? <Notice tone="red" text={errors.latency} /> : null}
      {errors.awake ? <Notice tone="red" text={errors.awake} /> : null}
      {errors.notes ? <Notice tone="red" text={errors.notes} /> : null}
      {warnings.map((w) => (
        <Notice key={w} tone="ochre" text={w} />
      ))}
      {failure ? <Notice tone="ochre" text={`Saved on your phone, not sent yet. ${failure}`} /> : null}

      <PrimaryButton title={warnings.length > 0 ? 'Save anyway' : 'Save night'} testID="sleep-save" onPress={() => void save()} busy={saving} />
      <View />
    </Screen>
  );
}

const s = StyleSheet.create({
  stepper: { justifyContent: 'space-between' },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.medium, fontSize: 26, color: colors.ink, marginTop: -3 },
  day: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
});
