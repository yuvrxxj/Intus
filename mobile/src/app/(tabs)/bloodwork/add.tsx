import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { emptyReadingForm, validateReadingForm, type ReadingFormErrors } from '../../../../../src/features/bloodwork/entry.ts';
import { formatRange } from '../../../../../src/features/bloodwork/format.ts';
import { todayKey } from '../../../../../src/util/dates.ts';
import { useAuth } from '../../../auth/AuthContext';
import { sendReading, type PendingReading } from '../../../data/bloodwork';
import { flushBucket, queueIn } from '../../../data/outbox';
import { outboxStore } from '../../../data/storage';
import { READINGS_BUCKET, useBloodwork } from '../../../bloodwork/useBloodwork';
import { colors, fonts } from '../../../theme/tokens';
import { uuid } from '../../../util/uuid';
import { Field, Group, Notice, PrimaryButton, Row, Screen } from '../../../ui/kit';

export default function Add() {
  const { session } = useAuth();
  const router = useRouter();
  const bw = useBloodwork();
  const { marker } = useLocalSearchParams<{ marker?: string }>();
  const [form, setForm] = useState(() => emptyReadingForm(todayKey()));
  const [errors, setErrors] = useState<ReadingFormErrors>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (bw.status !== 'ready') return <Screen>{bw.status === 'error' ? <Notice tone="red" text={bw.message} /> : <Notice text="Loading the markers…" />}</Screen>;

  const biomarker = bw.biomarkers.find((b) => b.id === (marker ?? form.biomarker_id));
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setWarning(null);
  };

  async function save() {
    const userId = session?.user.id;
    if (!userId || !biomarker) return;
    const result = validateReadingForm({ ...form, biomarker_id: biomarker.id }, bw.status === 'ready' ? bw.biomarkers : [], bw.status === 'ready' ? bw.readings : [], todayKey());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    // a number ten times outside the usual range is most likely the wrong unit: ask once, and the same press again saves
    if (result.warning && warning !== result.warning) {
      setWarning(result.warning);
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const entry: PendingReading = { id: uuid(), input: result.value, queuedAt: new Date().toISOString() };
      // on the phone first, then sent: a closed app or a lost connection never loses a result
      await queueIn(outboxStore, READINGS_BUCKET, userId, entry.id, entry);
      const flushed = await flushBucket<PendingReading>(outboxStore, READINGS_BUCKET, userId, sendReading);
      if (flushed.failed > 0) setFailure(flushed.error);
      router.dismissTo('/bloodwork');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Group label="Marker">
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a marker" testID="bw-pick" onPress={() => router.push('/bloodwork/pick')}>
          <Row first style={s.pick}>
            <Text style={biomarker ? s.picked : s.placeholder}>{biomarker ? `${biomarker.name} (${biomarker.unit})` : 'Choose a marker'}</Text>
            <Text style={s.chevron}>›</Text>
          </Row>
        </Pressable>
      </Group>
      {errors.biomarker_id ? <Notice tone="red" text={errors.biomarker_id} /> : null}

      <Group label="Result" note={biomarker ? `Use the unit on your report: ${biomarker.unit}. Plain numbers only, such as 4.2.` : undefined}>
        <Field first testID="bw-value" label="Result" unit={biomarker?.unit} placeholder="0" value={form.value} onChangeText={(v) => set({ value: v })} keyboardType="decimal-pad" maxLength={12} />
        <Field testID="bw-date" label="Sample taken" placeholder="YYYY-MM-DD" value={form.measured_at} onChangeText={(v) => set({ measured_at: v })} keyboardType="numbers-and-punctuation" maxLength={10} autoCorrect={false} />
      </Group>
      {errors.value ? <Notice tone="red" text={errors.value} /> : null}
      {errors.measured_at ? <Notice tone="red" text={errors.measured_at} /> : null}

      <Group
        label="Range printed on your report"
        note={biomarker && (biomarker.ref_low !== null || biomarker.ref_high !== null) ? `Leave blank to use the usual range (${formatRange(biomarker.ref_low === null ? null : Number(biomarker.ref_low), biomarker.ref_high === null ? null : Number(biomarker.ref_high))} ${biomarker.unit}) where it applies to you. A range on your report always comes first.` : 'Leave blank if your report has none.'}
      >
        <Field first testID="bw-ref-low" label="Low" unit={biomarker?.unit} placeholder="optional" value={form.ref_low} onChangeText={(v) => set({ ref_low: v })} keyboardType="decimal-pad" maxLength={12} />
        <Field testID="bw-ref-high" label="High" unit={biomarker?.unit} placeholder="optional" value={form.ref_high} onChangeText={(v) => set({ ref_high: v })} keyboardType="decimal-pad" maxLength={12} />
      </Group>
      {errors.ref_low ? <Notice tone="red" text={errors.ref_low} /> : null}
      {errors.ref_high ? <Notice tone="red" text={errors.ref_high} /> : null}

      <Group label="Note">
        <Field first testID="bw-notes" label="Note" placeholder="Anything to remember" value={form.notes} onChangeText={(v) => set({ notes: v })} maxLength={500} />
      </Group>
      {errors.notes ? <Notice tone="red" text={errors.notes} /> : null}

      {warning ? <Notice tone="ochre" text={warning} /> : null}
      {failure ? <Notice tone="ochre" text={`Saved on your phone, not sent yet. ${failure}`} /> : null}
      <PrimaryButton title={warning ? 'Save anyway' : 'Save result'} testID="bw-save" onPress={() => void save()} busy={saving} />
    </Screen>
  );
}

const s = StyleSheet.create({
  pick: { justifyContent: 'space-between' },
  picked: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, flexShrink: 1 },
  placeholder: { fontFamily: fonts.body, fontSize: 17, color: colors.ink3 },
  chevron: { fontFamily: fonts.medium, fontSize: 24, color: colors.ink3 },
});
