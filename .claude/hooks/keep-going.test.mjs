// Run with: node --test ".claude/hooks/*.test.mjs"
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { STALL_LIMIT, decide } from './keep-going.mjs';

function fresh() {
  const projectDir = mkdtempSync(join(tmpdir(), 'intus-stop-'));
  mkdirSync(join(projectDir, 'docs/ios'), { recursive: true });
  return { projectDir, stateFile: join(projectDir, '.state/stop.json') };
}

test('keeps going, then stops when DONE or STOP appears', () => {
  const a = fresh();
  assert.equal(decide(a).stop, false);
  writeFileSync(join(a.projectDir, 'docs/ios/DONE'), 'COMPLETE');
  assert.equal(decide(a).stop, true);

  const b = fresh();
  assert.equal(decide(b).stop, false);
  writeFileSync(join(b.projectDir, 'docs/ios/STOP'), '');
  assert.equal(decide(b).stop, true);
});

test('gives up after a run of stops with no progress, and progress resets the count', () => {
  const s = fresh();
  const progress = join(s.projectDir, 'docs/ios/PROGRESS.md');
  writeFileSync(progress, 'rung 1');
  utimesSync(progress, new Date(1_000_000), new Date(1_000_000));
  for (let i = 0; i < STALL_LIMIT; i++) assert.equal(decide(s).stop, false, `stop ${i + 1}`);
  assert.equal(decide(s).stalled, true);

  const t = fresh();
  const p = join(t.projectDir, 'docs/ios/PROGRESS.md');
  writeFileSync(p, 'rung 1');
  utimesSync(p, new Date(1_000_000), new Date(1_000_000));
  for (let i = 0; i < STALL_LIMIT - 1; i++) decide(t);
  utimesSync(p, new Date(2_000_000), new Date(2_000_000));
  for (let i = 0; i < STALL_LIMIT; i++) assert.equal(decide(t).stop, false, 'progress made, so the count starts again');
});

test('the hook process is inert when off and prints a block decision when on', () => {
  const script = fileURLToPath(new URL('./keep-going.mjs', import.meta.url));
  const { projectDir } = fresh();
  const run = (env) => spawnSync('node', [script], { input: '{}', env: { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: projectDir, ...env }, encoding: 'utf8' });
  const off = run({});
  assert.equal(off.status, 0);
  assert.equal(off.stdout, '');
  const on = run({ INTUS_IOS_OVERNIGHT: '1' });
  assert.equal(on.status, 0);
  assert.equal(JSON.parse(on.stdout).decision, 'block');
});
