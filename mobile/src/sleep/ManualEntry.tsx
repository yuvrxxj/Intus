import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { LIMITS, validateSleepForm, type SleepErrors, type SleepForm, type SleepSession, type SleepValues } from '../../../src/features/sleep/model.ts';
import { sessionMetrics } from '../../../src/features/sleep/metrics.ts';
import { formatDuration } from '../../../src/features/sleep/time.ts';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { blankSleepForm, deviceResolver } from './rules';

const zoneName = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

function splitStamp(stamp: string): [string, string] {
  const [date, time] = stamp.split('T');
  return [date ?? '', (time ?? '').slice(0, 5)];
}

/** A night typed by hand, checked with the same rules as the website, then saved to sleep_sessions. */
export function ManualEntry({
  today,
  nowMs,
  existing,
  accent,
  onSave,
}: {
  today: string;
  nowMs: number;
  existing: readonly SleepSession[];
  /** when true, Save is the screen's one red action */
  accent: boolean;
  onSave: (values: SleepValues) => Promise<void>;
}) {
  const blank = blankSleepForm(today);
  const [bedDate, bedTime] = splitStamp(blank.start);
  const [upDate, upTime] = splitStamp(blank.end);
  const [startDate, setStartDate] = useState(bedDate);
  const [startTime, setStartTime] = useState(bedTime);
  const [endDate, setEndDate] = useState(upDate);
  const [endTime, setEndTime] = useState(upTime);
  const [latency, setLatency] = useState('');
  const [awake, setAwake] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<SleepErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const form: SleepForm = {
    start: `${startDate.trim()}T${startTime.trim()}`,
    end: `${endDate.trim()}T${endTime.trim()}`,
    latency,
    awake,
    notes,
  };
  const ctx = useMemo(
    () => ({ nowMs, resolve: deviceResolver, tzId: zoneName(), existing, editingId: null }),
    [nowMs, existing],
  );
  const preview = useMemo(() => {
    const result = validateSleepForm(form, ctx);
    if (!result.ok) return null;
    const session: SleepSession = {
      id: 'preview',
      sourceKind: 'manual',
      sourceName: null,
      externalId: null,
      start: Date.parse(result.value.start_at),
      end: Date.parse(result.value.end_at),
      startOffsetMin: result.value.start_offset_min,
      endOffsetMin: result.value.end_offset_min,
      tzId: result.value.tz_id,
      latencyMin: result.value.latency_min,
      awakeMin: result.value.awake_min,
      stages: [],
      startIsInBed: true,
      notes: null,
      recordedAt: nowMs,
    };
    return { metrics: sessionMetrics(session), warnings: result.warnings };
  }, [form, ctx, nowMs]);

  function edit(set: (value: string) => void, value: string) {
    set(value);
    setConfirming(false);
  }

  async function submit() {
    const result = validateSleepForm(form, ctx);
    if (!result.ok) {
      setErrors(result.errors);
      setConfirming(false);
      return;
    }
    setErrors({});
    if (result.warnings.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      await onSave(result.value);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.label}>Add a night</Text>
      <Text style={s.hint}>For when Apple Health is off or has nothing to read. Saved to your account, which only you can see.</Text>
      <View style={s.row}>
        <View style={s.field}>
          <Text style={s.hint}>Got into bed</Text>
          <TextInput
            accessibilityLabel="Got into bed, date"
            style={s.input}
            value={startDate}
            onChangeText={(value) => edit(setStartDate, value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
          />
        </View>
        <View style={s.field}>
          <Text style={s.hint}>Time</Text>
          <TextInput
            accessibilityLabel="Got into bed, time"
            style={s.input}
            value={startTime}
            onChangeText={(value) => edit(setStartTime, value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="HH:MM"
            inputMode="numeric"
          />
        </View>
      </View>
      {errors.start ? <Text style={s.error} accessibilityRole="alert">{errors.start}</Text> : null}
      <View style={s.row}>
        <View style={s.field}>
          <Text style={s.hint}>Got up</Text>
          <TextInput
            accessibilityLabel="Got up, date"
            style={s.input}
            value={endDate}
            onChangeText={(value) => edit(setEndDate, value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
          />
        </View>
        <View style={s.field}>
          <Text style={s.hint}>Time</Text>
          <TextInput
            accessibilityLabel="Got up, time"
            style={s.input}
            value={endTime}
            onChangeText={(value) => edit(setEndTime, value)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="HH:MM"
            inputMode="numeric"
          />
        </View>
      </View>
      {errors.end ? <Text style={s.error} accessibilityRole="alert">{errors.end}</Text> : null}
      <View style={s.field}>
        <Text style={s.hint}>Minutes to fall asleep</Text>
        <TextInput
          accessibilityLabel="Minutes to fall asleep"
          style={s.input}
          value={latency}
          onChangeText={(value) => edit(setLatency, value)}
          keyboardType="number-pad"
          placeholder="Optional"
          maxLength={3}
        />
        {errors.latency ? <Text style={s.error} accessibilityRole="alert">{errors.latency}</Text> : null}
      </View>
      <View style={s.field}>
        <Text style={s.hint}>Minutes awake in the night</Text>
        <TextInput
          accessibilityLabel="Minutes awake in the night"
          style={s.input}
          value={awake}
          onChangeText={(value) => edit(setAwake, value)}
          keyboardType="number-pad"
          placeholder="Optional"
          maxLength={3}
        />
        {errors.awake ? <Text style={s.error} accessibilityRole="alert">{errors.awake}</Text> : null}
      </View>
      <View style={s.field}>
        <Text style={s.hint}>Note</Text>
        <TextInput
          accessibilityLabel="Note"
          style={s.input}
          value={notes}
          onChangeText={(value) => edit(setNotes, value)}
          placeholder="Optional"
          maxLength={LIMITS.notesChars}
        />
        {errors.notes ? <Text style={s.error} accessibilityRole="alert">{errors.notes}</Text> : null}
      </View>
      {preview ? (
        <Text style={s.body} accessibilityRole="summary">
          {preview.metrics.basis === 'bed_to_wake'
            ? `${formatDuration(preview.metrics.tibMin)} from getting into bed to getting up.`
            : `${formatDuration(preview.metrics.tstMin)} asleep, ${formatDuration(preview.metrics.tibMin)} in bed.`}
        </Text>
      ) : null}
      {confirming && preview ? preview.warnings.map((warning) => (
        <Text key={warning} style={s.error} accessibilityRole="alert">{warning}</Text>
      )) : null}
      {failure ? <Text style={s.error} accessibilityRole="alert">Could not save: {failure}</Text> : null}
      <Button
        label={busy ? 'Saving' : confirming ? 'Save anyway' : 'Save night'}
        tone={accent ? 'red' : 'quiet'}
        onPress={() => void submit()}
        busy={busy}
      />
    </View>
  );
}
