import { useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, Text } from 'react-native';
import { RANGE_LABEL, formatDay, formatRange, formatValue } from '../../../../../../src/features/bloodwork/format.ts';
import { MARKER_INFO, MEDLINEPLUS_REVIEW_NOTE, medlinePlusUrl } from '../../../../../../src/features/bloodwork/markerInfo.ts';
import { rangeSourceLabel } from '../../../../../../src/lib/ranges.ts';
import { useBloodwork } from '../../../../bloodwork/useBloodwork';
import { deleteReading } from '../../../../data/bloodwork';
import { colors, fonts } from '../../../../theme/tokens';
import { Group, Notice, Row, Screen, TextButton } from '../../../../ui/kit';

// A marker, as a sheet: what it is, when it is high or low, what helps, the range this result was read against, and its history.
export default function Marker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bw = useBloodwork();

  if (bw.status !== 'ready') return <Screen>{bw.status === 'error' ? <Notice tone="red" text={bw.message} /> : <Notice text="Loading…" />}</Screen>;
  const row = bw.view.groups.flatMap((g) => g.rows).find((r) => r.biomarker.id === id);
  if (!row) return <Screen><Notice text="No results for this marker yet." /></Screen>;

  const { biomarker, rangeUsed } = row;
  const info = MARKER_INFO[biomarker.code];
  const history = [...row.points].reverse();

  function confirmDelete(readingId: string, when: string) {
    Alert.alert('Delete this result?', `The ${biomarker.name} result from ${when} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteReading(readingId).then(bw.reload, (e: unknown) => Alert.alert('Could not delete', e instanceof Error ? e.message : String(e))) },
    ]);
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={s.title}>
        {biomarker.name}
      </Text>
      <Group label="Your range">
        <Row first>
          <Text style={s.body}>
            {rangeUsed.source === 'none' ? rangeSourceLabel(rangeUsed) : `${formatRange(rangeUsed.low, rangeUsed.high)} ${biomarker.unit}, ${rangeSourceLabel(rangeUsed)}`}
          </Text>
        </Row>
      </Group>
      {info ? (
        <>
          <Group label="What it is">
            <Row first>
              <Text style={s.body}>{info.what}</Text>
            </Row>
          </Group>
          <Group label="When it is high">
            <Row first>
              <Text style={s.body}>{info.high}</Text>
            </Row>
          </Group>
          {info.low ? (
            <Group label="When it is low">
              <Row first>
                <Text style={s.body}>{info.low}</Text>
              </Row>
            </Group>
          ) : null}
          <Group label="What helps">
            <Row first>
              <Text style={s.body}>{info.habits}</Text>
            </Row>
          </Group>
          <Text style={s.source}>{MEDLINEPLUS_REVIEW_NOTE}</Text>
          <TextButton title={`MedlinePlus: ${biomarker.name}`} onPress={() => void Linking.openURL(medlinePlusUrl(info.loinc))} />
        </>
      ) : null}
      <Group label="Your results">
        {history.map((p, i) => (
          <Row key={p.id} first={i === 0} style={s.point}>
            <Text style={s.pointText}>{formatDay(p.measured_at)}</Text>
            <Text style={s.pointValue}>
              {formatValue(p.value)} {biomarker.unit}
            </Text>
            <Text style={s.pointRange}>{RANGE_LABEL[p.range]}</Text>
            {p.source === 'manual' && !bw.unsentIds.has(p.id) ? <TextButton title="Delete" tone="ink" onPress={() => confirmDelete(p.id, formatDay(p.measured_at))} /> : null}
          </Row>
        ))}
      </Group>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.6, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, flex: 1 },
  source: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, paddingHorizontal: 4 },
  point: { flexWrap: 'wrap', gap: 6 },
  pointText: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink3, minWidth: 96 },
  pointValue: { fontFamily: fonts.monoSemibold, fontSize: 15, color: colors.ink, flex: 1 },
  pointRange: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3 },
});
