import { useRef, useState } from 'react';
import { Platform, Text, TextInput, View, type TextInputInstance } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LIMITS, validateSleepForm, type SleepErrors, type SleepForm, type SleepSession, type SleepValues } from '../../../src/features/sleep/model.ts';
import { sessionMetrics } from '../../../src/features/sleep/metrics.ts';
import { formatDuration } from '../../../src/features/sleep/time.ts';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { ErrorNotice } from '../ui/ErrorNotice';
import { NEXT, blankSleepForm, dateFromStamp, deviceResolver, stampFromDate } from './rules';

const zoneName = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

function initialDate(stamp: string): Date {
  const when = dateFromStamp(stamp) ?? new Date();
  return when.getTime() > Date.now() ? new Date() : when;
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
  const [start, setStart] = useState(() => initialDate(blank.start));
  const [end, setEnd] = useState(() => initialDate(blank.end));
  const [latency, setLatency] = useState('');
  const [awake, setAwake] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<SleepErrors>({});
  const [failure, setFailure] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'latency' | 'awake' | 'notes' | null>(null);
  const awakeRef = useRef<TextInputInstance>(null);
  const notesRef = useRef<TextInputInstance>(null);

  const form: SleepForm = {
    start: stampFromDate(start),
    end: stampFromDate(end),
    latency,
    awake,
    notes,
  };
  const ctx = { nowMs, resolve: deviceResolver, tzId: zoneName(), existing, editingId: null };
  const checked = validateSleepForm(form, ctx);
  const preview = checked.ok
    ? sessionMetrics({
      id: 'preview',
      sourceKind: 'manual',
      sourceName: null,
      externalId: null,
      start: Date.parse(checked.value.start_at),
      end: Date.parse(checked.value.end_at),
      startOffsetMin: checked.value.start_offset_min,
      endOffsetMin: checked.value.end_offset_min,
      tzId: checked.value.tz_id,
      latencyMin: checked.value.latency_min,
      awakeMin: checked.value.awake_min,
      stages: [],
      startIsInBed: true,
      notes: null,
      recordedAt: nowMs,
    } satisfies SleepSession)
    : null;

  function changeTime(set: (value: Date) => void, value: Date | undefined) {
    if (!value) return;
    set(value);
    setConfirming(false);
  }

  function changeText(set: (value: string) => void, value: string) {
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
    setFailure(false);
    setBusy(true);
    try {
      await onSave(result.value);
    } catch {
      setFailure(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.label}>Add a night</Text>
      <Text style={s.hint}>Saved to your account, which only you can see. intus.fit reads the same nights.</Text>
      <WhenField label="Got into bed" value={start} invalid={!!errors.start} message={errors.start} onChange={(value) => changeTime(setStart, value)} />
      <WhenField label="Got up" value={end} invalid={!!errors.end} message={errors.end} onChange={(value) => changeTime(setEnd, value)} />
      <View style={s.field}>
        <Text style={s.hint}>Minutes to fall asleep</Text>
        <TextInput
          accessibilityLabel="Minutes to fall asleep, optional"
          accessibilityHint="Optional"
          style={[s.input, focused === 'latency' && s.inputFocus, errors.latency && s.inputInvalid]}
          onFocus={() => setFocused('latency')}
          onBlur={() => setFocused((current) => current === 'latency' ? null : current)}
          value={latency}
          onChangeText={(value) => changeText(setLatency, value)}
          keyboardType="number-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => awakeRef.current?.focus()}
          placeholder="Optional"
          maxLength={3}
        />
        {errors.latency ? <ErrorNotice message={errors.latency} /> : null}
      </View>
      <View style={s.field}>
        <Text style={s.hint}>Minutes awake in the night</Text>
        <TextInput
          ref={awakeRef}
          accessibilityLabel="Minutes awake in the night, optional"
          accessibilityHint="Optional"
          style={[s.input, focused === 'awake' && s.inputFocus, errors.awake && s.inputInvalid]}
          onFocus={() => setFocused('awake')}
          onBlur={() => setFocused((current) => current === 'awake' ? null : current)}
          value={awake}
          onChangeText={(value) => changeText(setAwake, value)}
          keyboardType="number-pad"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => notesRef.current?.focus()}
          placeholder="Optional"
          maxLength={3}
        />
        {errors.awake ? <ErrorNotice message={errors.awake} /> : null}
      </View>
      <View style={s.field}>
        <Text style={s.hint}>Note</Text>
        <TextInput
          ref={notesRef}
          accessibilityLabel="Note, optional"
          style={[s.input, focused === 'notes' && s.inputFocus, errors.notes && s.inputInvalid]}
          onFocus={() => setFocused('notes')}
          onBlur={() => setFocused((current) => current === 'notes' ? null : current)}
          value={notes}
          onChangeText={(value) => changeText(setNotes, value)}
          placeholder="Optional"
          maxLength={LIMITS.notesChars}
        />
        {errors.notes ? <ErrorNotice message={errors.notes} /> : null}
      </View>
      {preview ? (
        <Text style={s.body} accessibilityRole="summary">
          {preview.basis === 'bed_to_wake'
            ? `${formatDuration(preview.tibMin)} from getting into bed to getting up.`
            : `${formatDuration(preview.tstMin)} asleep, ${formatDuration(preview.tibMin)} in bed.`}
        </Text>
      ) : null}
      {confirming && checked.ok ? checked.warnings.map((warning) => (
        <Text key={warning} style={s.warning} accessibilityRole="alert">{warning}</Text>
      )) : null}
      {failure ? <ErrorNotice message={NEXT.save} /> : null}
      <Button
        label={confirming ? 'Save anyway' : 'Save night'}
        tone={accent ? 'red' : 'quiet'}
        onPress={() => void submit()}
        busy={busy}
      />
    </View>
  );
}

function WhenField({
  label,
  value,
  invalid,
  message,
  onChange,
}: {
  label: string;
  value: Date;
  invalid: boolean;
  message?: string;
  onChange: (value: Date) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.hint}>{label}</Text>
      <View style={[s.picker, invalid && s.inputInvalid]}>
        <DateTimePicker
          accessibilityLabel={label}
          value={value}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          themeVariant="light"
          maximumDate={new Date()}
          onChange={(_event, next) => onChange(next ?? value)}
        />
      </View>
      {message ? <ErrorNotice message={message} /> : null}
    </View>
  );
}
