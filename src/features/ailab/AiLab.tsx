import { useMemo, useState, type ChangeEvent } from 'react';
import ledgerText from '../../../docs/ai-testing/ledger.jsonl?raw';
import facts from '../../../docs/ai-testing/models.json';
import { CriticalBanner } from '../bloodwork/CriticalBanner.tsx';
import { formatDay } from '../bloodwork/format.ts';
import { MarkerTable } from '../bloodwork/MarkerTable.tsx';
import { configName } from './groq.ts';
import { money, parseLedger, seconds, summarise, usedInLastDay } from './ledger.ts';
import { OBSERVED, PUBLISHED } from './limits.ts';
import { previewRows } from './preview.ts';
import type { ModelFacts, RunFile, RunMetrics } from './types.ts';
import './ailab.css';

const RUNS = parseLedger(ledgerText);
const MODELS = facts as ModelFacts[];
// run files hold rows read from a real report, so they are not in git: they exist only where the benchmark was run
const LOCAL = Object.values(import.meta.glob<RunFile>('/test-lab/local/*.run.json', { eager: true, import: 'default' })).sort((a, b) => b.at.localeCompare(a.at));

const TODAY = new Date().toISOString().slice(0, 10);
const OUTCOME_LABEL = { complete: 'Whole report', partial: 'Part of it', failed: 'Failed', trial: 'First chunk only' } as const;
const num = (n: number) => n.toLocaleString('en-GB');
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Models() {
  const now = Date.now();
  return (
    <div className="card sec">
      <div className="ct"><span className="dot dot-red" />Groq models on this key</div>
      <div className="bw-sub">Limits are per organisation. Tokens per minute and requests per day come back on every answer; the rest are from Groq's rate-limits page.</div>
      <div className="bt-wrap">
        <table className="bt al-table">
          <thead><tr><th>Model</th><th>Context</th><th>Price per million (in / out / cached in)</th><th>Per minute</th><th>Per day</th><th>Used in the last 24 hours</th></tr></thead>
          <tbody>
            {MODELS.map((m) => {
              const p = PUBLISHED[m.id];
              const used = usedInLastDay(RUNS, m.id, now);
              const tpd = p?.tpd ?? null;
              return (
                <tr key={m.id}>
                  <td data-label="Model"><strong>{m.id}</strong>{OBSERVED[m.id] && <div className="fld-hint">{OBSERVED[m.id]}</div>}</td>
                  <td data-label="Context">{m.contextWindow ? num(m.contextWindow) : 'n/a'}</td>
                  <td data-label="Price">{m.pricePerMillion ? `$${m.pricePerMillion.prompt.toFixed(3)} / $${m.pricePerMillion.completion.toFixed(3)} / $${m.pricePerMillion.cachedPrompt.toFixed(3)}` : 'not listed'}</td>
                  <td data-label="Per minute">{num(m.tokensPerMinute ?? p?.tpm ?? 0)} tokens{p ? `, ${p.rpm} requests` : ''}</td>
                  <td data-label="Per day">{p ? `${num(p.tpd)} tokens, ` : ''}{num(m.requestsPerDay ?? p?.rpd ?? 0)} requests</td>
                  <td data-label="Used">
                    {num(used.tokens)} tokens, {used.requests} requests
                    {tpd && <div className="al-meter" role="img" aria-label={`${pct(used.tokens / tpd)} of the daily token limit`}><span style={{ width: `${Math.min(100, (used.tokens / tpd) * 100)}%` }} /></div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Runs() {
  const rows = useMemo(() => RUNS.map((r) => ({ run: r, summary: summarise(r) })), []);
  return (
    <div className="card sec">
      <div className="ct"><span className="dot dot-red" />Every run</div>
      <div className="bw-sub">The same redacted report and the same prompt as the app, sent in chunks because of the per-minute token limit (each run says how big, and how many output tokens it was allowed). "Found" is how many of the results the app's own on-device reader finds that the model found too, on the same line with the same number. Cost is at Groq's pay-as-you-go list price; this key's allowance is free.</div>
      <div className="bt-wrap">
        <table className="bt al-table">
          <thead>
            <tr><th>Model and setting</th><th>Outcome</th><th>Time</th><th>Tokens in / out</th><th>Reasoning</th><th>Cost</th><th>Limit hits</th><th>Found</th><th>Tracked markers</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9}>No runs yet.</td></tr>}
            {rows.map(({ run, summary }) => <RunRow key={run.id} run={run} outcome={summary.outcome} failures={summary.failures} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunRow({ run, outcome, failures }: { run: RunMetrics; outcome: keyof typeof OUTCOME_LABEL; failures: Record<string, number> }) {
  const t = run.totals;
  const s = run.score;
  const why = Object.entries(failures).map(([k, n]) => `${n} ${k.replace('_', ' ')}`).join(', ');
  return (
    <tr>
      <td data-label="Model and setting"><strong>{configName(run.config)}</strong><div className="fld-hint">{run.config.mode === 'schema' ? 'strict JSON schema' : 'JSON mode'}, {run.chunks}/{run.totalChunks} chunks of up to {num(run.chunkChars)} characters, up to {num(run.maxTokens)} tokens out</div></td>
      <td data-label="Outcome"><span className={`al-badge al-${outcome}`}>{OUTCOME_LABEL[outcome]}</span>{why && <div className="fld-hint">{why}</div>}</td>
      <td data-label="Time">{seconds(t.elapsedS)}<div className="fld-hint">{seconds(t.requestS)} in requests, {seconds(t.waitedS)} held back for limits</div></td>
      <td data-label="Tokens">{num(t.promptTokens)} / {num(t.completionTokens)}{t.cachedTokens > 0 && <div className="fld-hint">{num(t.cachedTokens)} cached</div>}</td>
      <td data-label="Reasoning">{num(t.reasoningTokens)}</td>
      <td data-label="Cost">{money(t.costUsd)}</td>
      <td data-label="Limit hits">{t.rateLimited}{t.retries > 0 && <div className="fld-hint">{t.retries} retries</div>}</td>
      <td data-label="Found">{s && outcome !== 'trial' ? `${s.matched} of ${s.reference} (${pct(s.recall)})` : 'n/a'}{s && outcome !== 'trial' && <div className="fld-hint">{s.extra} more, {s.dropped} dropped as not printed</div>}</td>
      <td data-label="Tracked markers">
        {s && outcome !== 'trial' ? `${s.trackedMatched} of ${s.trackedReference}` : 'n/a'}
        {s && outcome !== 'trial' && s.trackedConflicts > 0 && <div className="fld-hint">{s.trackedConflicts} with a different number</div>}
        {s && outcome !== 'trial' && s.differentMarker > 0 && <div className="fld-hint">{s.differentMarker} named a different marker than the app's reader</div>}
      </td>
    </tr>
  );
}

function Preview() {
  const [picked, setPicked] = useState<RunFile[]>([]);
  const runs = useMemo(() => [...picked, ...LOCAL].filter((r) => r.rows.length > 0), [picked]);
  const [id, setId] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const run = runs.find((r) => r.id === id) ?? runs[0] ?? null;
  const preview = useMemo(() => (run ? previewRows(run.rows, run.date, TODAY) : null), [run]);

  async function load(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const loaded: RunFile[] = [];
    for (const file of files) {
      try {
        const json = JSON.parse(await file.text()) as RunFile;
        if (Array.isArray(json.rows) && json.config) loaded.push(json);
      } catch {
        // not a run file: skipped
      }
    }
    if (loaded.length > 0) {
      setPicked((p) => [...loaded, ...p]);
      setId(loaded[0].id);
    }
  }

  function toggle(biomarkerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(biomarkerId)) next.delete(biomarkerId);
      else next.add(biomarkerId);
      return next;
    });
  }

  return (
    <div className="card sec">
      <div className="ct"><span className="dot dot-red" />Bloodwork, as a model's reading would fill it</div>
      <div className="bw-sub">A model's rows go through the same steps as an upload in the app: the review table's rules, the checks a result gets when it is saved, then the screen below. Nothing is saved anywhere. Rows the review table would leave unticked are listed underneath with their reasons.</div>
      <div className="al-pick">
        <select aria-label="Run to show" value={run?.id ?? ''} onChange={(e) => setId(e.target.value)} disabled={runs.length === 0}>
          {runs.length === 0 && <option value="">No run files here</option>}
          {runs.map((r) => <option key={r.id} value={r.id}>{configName(r.config)}, {r.at.slice(11, 16)} UTC, {r.score ? `${r.score.matched} of ${r.score.reference} found` : 'no score'}</option>)}
        </select>
        <label className="btn">
          Open a run file
          <input type="file" accept="application/json,.json" multiple onChange={load} hidden />
        </label>
      </div>
      {!run || !preview ? (
        <div className="empty">No run files are loaded. They are written to test-lab/local/ when the benchmark runs on your machine and are not in git, so a real report's results never leave it. Open one with the button.</div>
      ) : (
        <>
          <CriticalBanner current={preview.view.currentCritical} past={preview.view.pastCritical} />
          <div className="bw-head"><div className="bw-sub">Latest results {formatDay(preview.date)} · {preview.view.readingCount} results shown from {configName(run.config)}</div></div>
          <div className="glow-line" />
          {preview.view.groups.map((group) => (
            <section key={group.category}>
              <div className="bio-sec">{group.category}</div>
              <MarkerTable rows={group.rows} expanded={expanded} onToggle={toggle} />
            </section>
          ))}
          {preview.left.length > 0 && (
            <details className="bw-none" open>
              <summary>{preview.left.length} row{preview.left.length === 1 ? '' : 's'} left unticked in the review table</summary>
              <ul className="al-left">{preview.left.map((r) => <li key={r.key}><strong>{r.label}</strong>: {r.issue}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export default function AiLab() {
  return (
    <main className="al-wrap">
      <header className="al-head">
        <div className="al-kicker">Test environment</div>
        <h1>Intus AI testing</h1>
        <p>Choosing which AI model should read a lab report and fill the Bloodwork screen. This is not the live site. No database is read or written here, nothing on this page can be saved to an account, and none of it ships.</p>
      </header>
      <Models />
      <Runs />
      <Preview />
    </main>
  );
}
