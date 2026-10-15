#!/usr/bin/env node
// Stop hook for the unattended iOS run. Inert unless INTUS_IOS_OVERNIGHT=1.
//
// Nobody is awake to answer "shall I continue?", so when the agent tries to stop it is told to carry on, until:
//   - docs/ios/DONE exists (the agent writes it last, after docs/ios/MORNING.md), or
//   - docs/ios/STOP exists (a person asking it to stop), or
//   - it has stalled: STALL_LIMIT stops in a row with no change to docs/ios/PROGRESS.md.
// Progress resets the count, so a long productive night is never cut off, and a stuck one stops burning tokens.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STALL_LIMIT = 8;

export function decide({ projectDir, stateFile }) {
  const at = (p) => join(projectDir, 'docs/ios', p);
  if (existsSync(at('DONE')) || existsSync(at('STOP'))) return { stop: true };

  let progress = 0;
  try {
    progress = statSync(at('PROGRESS.md')).mtimeMs;
  } catch {
    // no progress file yet: the agent has not started writing one
  }
  let state = { count: 0, progress: 0 };
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    // first stop
  }
  const count = progress > state.progress ? 1 : state.count + 1;
  if (count > STALL_LIMIT) return { stop: true, stalled: true };
  mkdirSync(join(stateFile, '..'), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ count, progress }));
  return {
    stop: false,
    reason:
      `Nobody is awake to answer, so do not stop to ask. Open docs/ios/PROGRESS.md, take the next rung that is not done or marked blocked, ` +
      `and carry on (stop ${count} of ${STALL_LIMIT} without a progress note). If every rung is done or blocked: write docs/ios/MORNING.md, ` +
      `update Linear and the Intus.iOS Miro board, then create docs/ios/DONE containing COMPLETE or STOPPED and one line saying why.`,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.env.INTUS_IOS_OVERNIGHT !== '1') process.exit(0);
  try {
    let input = {};
    try {
      input = JSON.parse(readFileSync(0, 'utf8'));
    } catch {
      // the hook still works without its input
    }
    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const stateFile = join(tmpdir(), 'intus-ios-overnight', `${createHash('sha1').update(projectDir).digest('hex').slice(0, 12)}.json`);
    const result = decide({ projectDir, stateFile });
    if (!result.stop) process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
  } catch {
    // a broken hook must not trap the session: let it stop
  }
  process.exit(0);
}
