import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { fetchActivitySince } from '../data/activity';
import { available } from '../healthkit';
import { stacksForFontScale, todayKey } from '../sleep/rules';
import { s } from '../theme/styles';
import { color } from '../theme/tokens';
import { Button } from '../ui/Button';
import { ErrorNotice } from '../ui/ErrorNotice';
import { ACTIVITY_COPY, historyStart, presentActivity, type ActivityLine, type ActivityPresentation } from './rules';

const PAGE = 14;

/**
 * Steps and active calories, day by day, as Apple Health reports them. Reading only: the sync that fills this in is the
 * Sync now button on the Sleep tab, so there is one place that asks Apple for permission.
 */
export function ActivityScreen() {
  const [view, setView] = useState<ActivityPresentation | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshProblem, setRefreshProblem] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const request = useRef(0);
  const { fontScale } = useWindowDimensions();
  const stacked = stacksForFontScale(fontScale);
  const healthOn = available();

  const load = useCallback(async (initial: boolean) => {
    const id = ++request.current;
    if (initial) setStatus('loading');
    const today = todayKey(new Date());
    try {
      const rows = await fetchActivitySince(historyStart(today));
      if (request.current !== id) return;
      setView(presentActivity(rows, today));
      setRefreshProblem(false);
      setStatus('ready');
    } catch {
      if (request.current !== id) return;
      if (initial) setStatus('error');
      else setRefreshProblem(true);
    }
  }, []);

  // Load on first open, and again each time the tab is opened, so a sync done on the Sleep tab shows up here.
  const firstOpen = useRef(true);
  useFocusEffect(
    useCallback(() => {
      void load(firstOpen.current);
      firstOpen.current = false;
    }, [load]),
  );

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.ink} />}
    >
      <Text style={s.largeTitle} accessibilityRole="header">{ACTIVITY_COPY.title}</Text>

      {status === 'loading' ? (
        <View style={s.field}>
          <ActivityIndicator color={color.ink} accessibilityLabel="Loading your activity" />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={s.card}>
          <Text style={s.title}>Your activity could not be loaded</Text>
          <ErrorNotice message={ACTIVITY_COPY.load} />
          <Button label="Try again" tone="quiet" onPress={() => void load(true)} />
        </View>
      ) : null}

      {status === 'ready' && view ? (
        <>
          {refreshProblem ? <ErrorNotice message={ACTIVITY_COPY.load} /> : null}
          {view.lines.length === 0 ? (
            <View style={s.card}>
              <Text style={s.title}>{ACTIVITY_COPY.emptyTitle}</Text>
              <Text style={s.body}>{healthOn ? ACTIVITY_COPY.empty : ACTIVITY_COPY.noHealth}</Text>
            </View>
          ) : (
            <>
              <View style={s.card}>
                <Text style={s.label}>{ACTIVITY_COPY.todayLabel}</Text>
                {view.today ? (
                  <View style={[s.stats, stacked && s.stacked]}>
                    <Figure label={ACTIVITY_COPY.stepsLabel} value={view.today.steps} stacked={stacked} />
                    <Figure label={ACTIVITY_COPY.kcalLabel} value={view.today.kcal} stacked={stacked} />
                  </View>
                ) : (
                  <Text style={s.body}>Nothing for today yet. Tap Sync now on the Sleep tab.</Text>
                )}
              </View>

              <View style={s.card}>
                <Text style={s.label}>{ACTIVITY_COPY.averageLabel}</Text>
                {view.averages ? (
                  <>
                    <View style={[s.stats, stacked && s.stacked]}>
                      <Figure label={ACTIVITY_COPY.stepsLabel} value={view.averages.steps} note={view.averages.steps ? `a day, from ${view.averages.stepDays} days` : undefined} stacked={stacked} />
                      <Figure label={ACTIVITY_COPY.kcalLabel} value={view.averages.kcal} note={view.averages.kcal ? `a day, from ${view.averages.kcalDays} days` : undefined} stacked={stacked} />
                    </View>
                    <Text style={s.hint}>{ACTIVITY_COPY.averageHint}</Text>
                  </>
                ) : (
                  <Text style={s.body}>{ACTIVITY_COPY.averageWaiting}</Text>
                )}
              </View>

              <View style={s.card}>
                <Text style={s.label}>{ACTIVITY_COPY.daysLabel}</Text>
                <Text style={s.hint}>{ACTIVITY_COPY.daysHint}</Text>
                {view.lines.slice(0, shown).map((day, index) => (
                  <DayRow key={day.day} line={day} first={index === 0} stacked={stacked} />
                ))}
                {view.lines.length > shown ? (
                  <Button label="Show earlier days" tone="quiet" onPress={() => setShown((count) => count + PAGE)} />
                ) : null}
                <Text style={s.hint}>{ACTIVITY_COPY.footnote}</Text>
              </View>
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Figure({ label, value, note, stacked }: { label: string; value: string | null; note?: string; stacked: boolean }) {
  return (
    <View style={[s.stat, stacked && s.statStacked]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.number}>{value ?? 'No record'}</Text>
      {note ? <Text style={s.hint}>{note}</Text> : null}
    </View>
  );
}

function DayRow({ line, first, stacked }: { line: ActivityLine; first: boolean; stacked: boolean }) {
  return (
    <View style={[s.night, first && s.nightFirst]}>
      <View style={[s.nightTop, stacked && s.stacked]}>
        <Text style={s.body}>{line.heading}</Text>
        <Text style={s.nightDuration}>{line.steps ? `${line.steps} steps` : 'No steps'}</Text>
      </View>
      <Text style={s.meta}>{line.kcal ? `${line.kcal} active` : 'No active calories'}</Text>
      {line.note ? <Text style={s.hint}>{line.note}</Text> : null}
    </View>
  );
}
