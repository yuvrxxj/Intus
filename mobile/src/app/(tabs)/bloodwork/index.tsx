import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ARROW, DIRECTION_WORD, RANGE_LABEL, describeDays, formatDay, formatDelta, formatRange, formatValue } from '../../../../../src/features/bloodwork/format.ts';
import type { MarkerRow } from '../../../../../src/features/bloodwork/model.ts';
import { CRITICAL, type CriticalFinding } from '../../../../../src/lib/safety.ts';
import { rangeSourceLabel } from '../../../../../src/lib/ranges.ts';
import { useBloodwork } from '../../../bloodwork/useBloodwork';
import { colors, fonts, radius } from '../../../theme/tokens';
import { Group, Notice, PrimaryButton, Row, Screen } from '../../../ui/kit';

const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

function limitCrossed(f: CriticalFinding): string {
  return f.status === CRITICAL.LOW
    ? `at or below the critical low limit of ${formatValue(f.critical_low ?? NaN)}`
    : `at or above the critical high limit of ${formatValue(f.critical_high ?? NaN)}`;
}

function Finding({ f }: { f: CriticalFinding }) {
  return (
    <Text style={s.finding}>
      <Text style={s.findingName}>{f.name ?? f.code}</Text> {formatValue(f.value)} {f.unit} on {formatDay(f.measured_at)}, {limitCrossed(f)}.
    </Text>
  );
}

function MarkerLine({ row, unsent, first, onPress }: { row: MarkerRow; unsent: boolean; first: boolean; onPress: () => void }) {
  const { biomarker, latest, change, rangeUsed } = row;
  const flagged = row.range === 'below' || row.range === 'above';
  const range = rangeUsed.source === 'none' ? rangeSourceLabel(rangeUsed) : `${formatRange(rangeUsed.low, rangeUsed.high)} ${biomarker.unit}, ${rangeSourceLabel(rangeUsed)}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${biomarker.name}, ${formatValue(latest.value)} ${biomarker.unit}, ${RANGE_LABEL[row.range]}`} testID={`marker-${biomarker.code}`} onPress={onPress}>
      <Row first={first} style={s.marker}>
        <View style={s.markerTop}>
          <Text style={s.markerName}>{biomarker.name}</Text>
          <Text style={s.markerValue}>
            {formatValue(latest.value)} <Text style={s.unit}>{biomarker.unit}</Text>
          </Text>
        </View>
        <Text style={[s.status, flagged && { color: colors.ochre }, row.range === 'in_range' && { color: colors.green }]}>{RANGE_LABEL[row.range]}</Text>
        <Text style={s.meta}>{range}</Text>
        <Text style={s.meta}>
          {formatDay(latest.measured_at)}
          {change ? ` · ${ARROW[change.direction]} ${DIRECTION_WORD[change.direction].toLowerCase()}${change.direction === 'flat' ? '' : ` ${formatDelta(change.delta)}`}, ${describeDays(change.days)}` : ''}
        </Text>
        {row.critical.status !== 'ok' && row.critical.status !== 'no_threshold' ? <Text style={s.criticalTag}>Critical limit reached</Text> : null}
        {unsent ? <Text style={s.unsent}>Not sent yet</Text> : null}
      </Row>
    </Pressable>
  );
}

export default function Bloodwork() {
  const bw = useBloodwork();
  const router = useRouter();

  return (
    <Screen onRefresh={bw.reload} refreshing={bw.status === 'loading'}>
      {bw.status === 'error' ? <Notice tone="red" text={`${bw.message} Pull down to try again.`} /> : null}
      {bw.status === 'loading' ? <Notice text="Loading your results…" /> : null}
      {bw.status === 'ready' ? (
        <>
          {bw.view.currentCritical.length > 0 ? (
            <View accessibilityRole="alert" style={s.banner}>
              <Text style={s.bannerHead}>
                Critical result{bw.view.currentCritical.length === 1 ? '' : 's'} on the latest test ({bw.view.currentCritical.length})
              </Text>
              {bw.view.currentCritical.map((f) => (
                <Finding key={`${f.biomarker_id}-${f.measured_at}`} f={f} />
              ))}
            </View>
          ) : null}
          {bw.view.pastCritical.length > 0 ? (
            <View style={[s.banner, s.bannerPast]}>
              <Text style={s.bannerHead}>
                Earlier result{bw.view.pastCritical.length === 1 ? '' : 's'} that crossed a critical limit ({bw.view.pastCritical.length})
              </Text>
              {bw.view.pastCritical.map((f) => (
                <Finding key={`${f.biomarker_id}-${f.measured_at}`} f={f} />
              ))}
              <Text style={s.past}>A later result exists for each of these markers.</Text>
            </View>
          ) : null}
          {bw.unsentIds.size > 0 ? (
            <Notice tone="ochre" text={`Not sent yet. ${bw.unsentIds.size === 1 ? 'One result is' : `${bw.unsentIds.size} results are`} saved on your phone and will go when you are back online.${bw.sendError ? ` (${bw.sendError})` : ''}`} />
          ) : null}

          <PrimaryButton title="Add a result" testID="bw-add" onPress={() => router.push('/bloodwork/add')} />

          {bw.view.groups.length === 0 ? <Notice text="No results yet. Add one from a lab report." /> : null}
          {bw.view.groups.map((g) => (
            <Group key={g.category} label={label(g.category)}>
              {g.rows.map((row, i) => (
                <MarkerLine
                  key={row.biomarker.id}
                  row={row}
                  first={i === 0}
                  unsent={row.points.some((p) => bw.unsentIds.has(p.id))}
                  onPress={() => router.push({ pathname: '/bloodwork/marker/[id]', params: { id: row.biomarker.id } })}
                />
              ))}
            </Group>
          ))}
          {bw.view.noResults.length > 0 ? <Text style={s.footnote}>No results yet for {bw.view.noResults.join(', ')}.</Text> : null}
          <Text style={s.footnote}>A range is where a result sits, never a diagnosis. Each result is read against the range printed on your report when you add it.</Text>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: colors.red, borderRadius: radius.card, padding: 16, gap: 6 },
  bannerPast: { backgroundColor: colors.ochre },
  bannerHead: { fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' },
  finding: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  findingName: { fontFamily: fonts.semibold },
  past: { fontFamily: fonts.body, fontSize: 13, color: '#FFFFFF' },
  marker: { flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingVertical: 12 },
  markerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  markerName: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, flexShrink: 1 },
  markerValue: { fontFamily: fonts.monoSemibold, fontSize: 17, color: colors.ink },
  unit: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  status: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  meta: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  criticalTag: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red },
  unsent: { fontFamily: fonts.body, fontSize: 13, color: colors.ochre },
  footnote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3, paddingHorizontal: 4 },
});
