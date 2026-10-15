#!/usr/bin/env node
// PreToolUse guard for the unattended iOS run (docs/ios/BRIEF.md).
//
// Inert unless INTUS_IOS_OVERNIGHT=1, which .claude/ios-overnight.settings.json sets, so every other session in this
// repo behaves as before. When active, exit code 2 blocks the tool call and stderr goes back to the agent as the reason.
// A crash while active also blocks: the run is unattended, so failing closed is the safe side.
//
// This is the layer that still holds in bypassPermissions mode. A Bash rule in settings only matches the form of a
// command it expects, so the checks here read the command the way a shell would (quotes, pipes, wrappers, bash -c).
// It is a seatbelt against an agent making a mistake at 3am, not a sandbox against a hostile one.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Files only a person edits. Production is changed through these.
const PROTECTED = [
  '.github/',
  'supabase/migrations/',
  'supabase/baseline.txt',
  'supabase/apply-migrations.sh',
  'vercel.json',
  '.claude/hooks/',
  '.claude/ios-overnight.settings.json',
  'scripts/ios-overnight.sh',
  'scripts/ios-preflight.sh',
  '.git/',
];

const NEVER_RUN = new Set([
  'sudo', 'doas', 'su', 'pkexec', 'supabase', 'psql', 'pgcli', 'pg_dump', 'pg_restore', 'vercel', 'vc', 'eas', 'eas-cli',
  'mkfs', 'diskutil', 'dd', 'shutdown', 'reboot', 'halt', 'launchctl', 'security', 'crontab', 'at', 'ssh', 'scp', 'sftp',
  'rsync', 'nc', 'ncat', 'netcat', 'socat', 'ios-deploy', 'ideviceinstaller', 'idevicedebug',
]);

const WRAPPERS = new Set(['env', 'time', 'nohup', 'exec', 'command', 'builtin', 'nice', 'caffeinate', 'xargs', 'stdbuf', 'timeout', 'gtimeout']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
const MUTATORS = new Set(['rm', 'mv', 'cp', 'ln', 'chmod', 'chown', 'touch', 'tee', 'truncate', 'install', 'sed', 'perl']);
const GH_ALLOWED = new Set(['pr create', 'pr view', 'pr list', 'pr status', 'pr checks', 'pr diff', 'pr comment', 'pr edit', 'run list', 'run view', 'run watch', 'issue view', 'issue list', 'auth status', '--version']);
const KILL_NEVER = /claude|finder|dock|loginwindow|systemuiserver|launchd|terminal|iterm|tmux|sshd?/i;

const block = (reason) => ({ block: true, reason });
const ok = { block: false };

// ── paths ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** realpath of the deepest part that exists, so a symlink cannot hide a protected folder */
function canon(p) {
  let cur = p;
  const tail = [];
  while (!existsSync(cur)) {
    const up = dirname(cur);
    if (up === cur) break;
    tail.unshift(basename(cur));
    cur = up;
  }
  const base = existsSync(cur) ? realpathSync(cur) : cur;
  return tail.length ? join(base, ...tail) : base;
}

function expand(p, ctx) {
  let out = p;
  if (out === '~' || out.startsWith('~/')) out = join(homedir(), out.slice(1));
  out = out.replace(/^\$\{?HOME\}?(?=\/|$)/, homedir());
  return isAbsolute(out) ? out : resolve(ctx.cwd, out);
}

function relToProject(abs, ctx) {
  const root = ctx.projectDir.endsWith(sep) ? ctx.projectDir : ctx.projectDir + sep;
  const c = canon(abs);
  if (c === ctx.projectDir) return '';
  return c.startsWith(root) ? c.slice(root.length).split(sep).join('/') : null;
}

function isProtectedRel(rel) {
  if (rel === null) return false;
  if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith('.env.example')) return true;
  return PROTECTED.some((p) => (p.endsWith('/') ? rel === p.slice(0, -1) || rel.startsWith(p) : rel === p));
}

/** Inside a temp or log directory. With strict, the directory itself does not count (so `rm -rf /tmp` is refused). */
function safeOutside(abs, strict = false) {
  const c = canon(abs);
  const roots = [tmpdir(), '/tmp', '/private/tmp', '/private/var/folders', join(homedir(), 'ios-overnight-logs'), join(homedir(), '.intus-ios')];
  return roots.some((r) => {
    const rc = canon(r);
    return (!strict && c === rc) || c.startsWith(rc + sep);
  });
}

// ── reading a command the way a shell would ──────────────────────────────────────────────────────────────────────

function stripHeredocs(cmd) {
  const lines = cmd.split('\n');
  const out = [];
  let end = null;
  for (const line of lines) {
    if (end !== null) {
      if (line.trim() === end) end = null;
      continue;
    }
    out.push(line);
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (m) end = m[2];
  }
  return out.join('\n');
}

/** Splits on unquoted separators. Quoted text stays inside its segment. */
function splitSegments(cmd) {
  const segs = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i];
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '\\' && i + 1 < cmd.length) {
      cur += ch + cmd[++i];
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '&' || ch === '(' || ch === ')' || ch === '`') {
      // `>&2` and `2>&1` are redirections, not command separators
      if (ch === '&' && (cmd[i - 1] === '>' || cmd[i + 1] === '>')) {
        cur += ch;
        continue;
      }
      if (cur.trim()) segs.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) segs.push(cur.trim());
  return segs;
}

function tokenize(seg) {
  const out = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < seg.length) cur += seg[++i];
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === '\\' && i + 1 < seg.length) {
      cur += seg[++i];
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = '';
      has = false;
      continue;
    }
    cur += ch;
    has = true;
  }
  if (has || cur) out.push(cur);
  return out;
}

const isFlag = (t) => t.startsWith('-');
const positional = (args) => args.filter((a) => !isFlag(a));

// ── Bash ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function checkBash(command, ctx, depth = 0) {
  if (depth > 5) return ok;
  const cmd = stripHeredocs(command);

  if (/\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(ba|z|da|k)?sh\b/.test(cmd)) {
    return block('Piping a download into a shell is not allowed. Download to a temp file, read it, then decide.');
  }
  if (/\b(echo|printf|print)\b[^\n;|&]*\$\{?INTUS_TEST_PASSWORD/.test(cmd) || /\bprintenv\s+INTUS_TEST_PASSWORD/.test(cmd)) {
    return block('Do not print the test password. Use $INTUS_TEST_EMAIL and $INTUS_TEST_PASSWORD directly in the command that needs them.');
  }
  if (/service_role|SERVICE_ROLE|sb_secret_/.test(cmd)) {
    return block('The Supabase service key must never be used here. The app and the checks run as the test user with the public key.');
  }

  // command substitutions can hide a command inside quotes
  for (const m of cmd.matchAll(/\$\(([^()]*)\)/g)) {
    const r = checkBash(m[1], ctx, depth + 1);
    if (r.block) return r;
  }

  // redirections that write somewhere they should not
  for (const m of cmd.matchAll(/(?:^|[\s;&|])\d*>>?\s*([^\s;&|<>]+)/g)) {
    const target = m[1];
    if (target.startsWith('&') || target === '/dev/null' || target === '/dev/stderr' || target === '/dev/stdout') continue;
    const abs = expand(target.replace(/^["']|["']$/g, ''), ctx);
    const rel = relToProject(abs, ctx);
    if (isProtectedRel(rel)) return block(`Writing to ${rel} is not allowed in this run. That file is changed by a person, through a pull request.`);
    if (rel === null && !safeOutside(abs)) return block(`Writing to ${target} (outside the repo) is not allowed. Use the repo or a temp directory.`);
  }

  for (const seg of splitSegments(cmd)) {
    const r = checkSegment(seg, ctx, depth);
    if (r.block) return r;
  }
  return ok;
}

function checkSegment(seg, ctx, depth) {
  let tokens = tokenize(seg);
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens = tokens.slice(1);
  if (!tokens.length) return ok;
  const prog = basename(tokens[0]);
  const rest = tokens.slice(1);

  if (NEVER_RUN.has(prog)) {
    const why = {
      sudo: 'No root. Everything this run needs works as a normal user.',
      supabase: 'The Supabase CLI can change production. Reads go through the app as the test user.',
      psql: 'No direct database connections. Production is changed only by a migration in a pull request.',
      vercel: 'Deploys are not part of this run.',
      eas: 'EAS builds and submissions are paid and out of scope. Use the local Simulator build.',
      launchctl: 'Do not change system services.',
      security: 'Do not touch the keychain from the shell.',
    }[prog === 'doas' || prog === 'pkexec' || prog === 'su' ? 'sudo' : prog === 'eas-cli' ? 'eas' : prog === 'vc' ? 'vercel' : ['pgcli', 'pg_dump', 'pg_restore'].includes(prog) ? 'psql' : prog];
    return block(`\`${prog}\` is not allowed in this run. ${why ?? 'It can change things outside the repo or cannot be undone.'}`);
  }

  if (WRAPPERS.has(prog)) {
    if (prog === 'env' && positional(rest).filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)).length === 0) {
      return block('`env` with no command prints every secret in the environment. Name the variable you need.');
    }
    const i = rest.findIndex((t) => !isFlag(t) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) && !(prog === 'timeout' || prog === 'gtimeout' ? /^\d+[smhd]?$/.test(t) : false));
    return i === -1 ? ok : checkSegment(rest.slice(i).join(' '), ctx, depth + 1);
  }

  if (SHELLS.has(prog)) {
    const ci = rest.findIndex((t) => /^-[a-z]*c[a-z]*$/.test(t));
    if (ci !== -1 && rest[ci + 1] !== undefined) return checkBash(rest[ci + 1], ctx, depth + 1);
    return ok;
  }
  if (prog === 'eval') return checkBash(rest.join(' '), ctx, depth + 1);

  if (prog === 'printenv' && rest.length === 0) return block('`printenv` with no argument prints every secret. Name the variable you need.');

  if (['cat', 'head', 'tail', 'less', 'more', 'bat', 'grep', 'rg', 'sed', 'awk', 'cut', 'base64', 'xxd', 'od', 'source', '.', 'cp', 'mv', 'open'].includes(prog) && /intus-ios-test\.env/.test(seg)) {
    return block('The test account file is not to be read or copied. Its values are already in $INTUS_TEST_EMAIL and $INTUS_TEST_PASSWORD.');
  }

  if (prog === 'npx' || prog === 'bunx' || prog === 'pnpx' || ((prog === 'pnpm' || prog === 'yarn') && (rest[0] === 'dlx' || rest[0] === 'exec')) || (prog === 'npm' && rest[0] === 'exec')) {
    const args = prog === 'npx' || prog === 'bunx' || prog === 'pnpx' ? rest : rest.slice(1);
    const pkgIdx = args.findIndex((t) => !isFlag(t));
    if (pkgIdx !== -1) {
      const pkg = args[pkgIdx].replace(/@[^/@]+$/, '');
      if (/^(eas|eas-cli|supabase|vercel|vc)$/.test(pkg)) return block(`\`${pkg}\` is not allowed in this run (paid, or it can change production).`);
      if (pkg === 'expo') return checkExpo(args.slice(pkgIdx + 1), seg);
      return checkSegment(args.slice(pkgIdx).join(' '), ctx, depth + 1);
    }
    return ok;
  }
  if (prog === 'expo') return checkExpo(rest, seg);

  if (prog === 'npm' || prog === 'yarn' || prog === 'pnpm') {
    const sub = rest[0];
    if (['publish', 'login', 'logout', 'adduser', 'token', 'owner', 'deprecate', 'unpublish', 'access'].includes(sub)) return block(`\`${prog} ${sub}\` is not allowed in this run.`);
    if (['install', 'i', 'add'].includes(sub) && rest.some((t) => t === '-g' || t === '--global')) return block('Global installs are not allowed. Install into the project, or tell the user in MORNING.md.');
    return ok;
  }

  if (prog === 'brew') {
    if (['uninstall', 'remove', 'rm', 'cleanup', 'untap', 'services', 'autoremove', 'upgrade', 'reinstall'].includes(rest[0])) {
      return block(`\`brew ${rest[0]}\` could break the toolchain. \`brew install\` is allowed.`);
    }
    return ok;
  }

  if (prog === 'xcodebuild') {
    if (rest.some((t) => /^-(allowProvisioning|exportArchive|authenticationKey)/.test(t))) {
      return block('Signing, device registration and exporting need an Apple account. This run builds for the Simulator only.');
    }
    return ok;
  }
  if (prog === 'xcrun') {
    const sub = rest[0];
    if (sub === 'altool' || sub === 'notarytool' || sub === 'devicectl') return block(`\`xcrun ${sub}\` is not allowed. Real devices and uploads are a morning step for the user.`);
    if (sub === 'simctl' && (rest[1] === 'delete' || (rest[1] === 'erase' && rest[2] === 'all'))) return block('Do not delete or wipe all Simulators. Erase the one device this run uses, by its id.');
    return ok;
  }

  if (prog === 'osascript' && /administrator privileges/.test(seg)) return block('No administrator prompts.');

  if (prog === 'killall' || prog === 'pkill') {
    return KILL_NEVER.test(seg) ? block('Do not kill that process.') : ok;
  }

  if (prog === 'git') return checkGit(rest, ctx, seg);
  if (prog === 'gh') return checkGh(rest);

  if (prog === 'curl' || prog === 'wget') {
    if (/supabase\.(co|com)/.test(seg) && /(-X|--request)\s*(DELETE|PUT|PATCH)|--method[ =](DELETE|PUT|PATCH)/i.test(seg)) {
      return block('Do not DELETE, PUT or PATCH against the production API from the shell. The app does its own writes as the test user.');
    }
    return ok;
  }

  if (prog === 'find') {
    const ei = rest.indexOf('-exec');
    if (ei !== -1) {
      const r = checkSegment(rest.slice(ei + 1).filter((t) => t !== ';' && t !== '\\;' && t !== '{}').join(' '), ctx, depth + 1);
      if (r.block) return r;
    }
    if (rest.includes('-delete')) {
      const target = positional(rest)[0] ?? '.';
      const rel = relToProject(expand(target, ctx), ctx);
      if (rel === null || isProtectedRel(rel)) return block('`find -delete` outside the repo, or in a protected path, is not allowed.');
    }
    return ok;
  }

  if (prog === 'rm' || prog === 'rmdir') {
    for (const t of positional(rest)) {
      if (/[$*]/.test(t) && /^([~/]|\$)/.test(t)) return block('Remove files by explicit path. A glob or variable at the top of a path is not allowed.');
      const abs = expand(t, ctx);
      const rel = relToProject(abs, ctx);
      if (rel === '') return block('Do not remove the repo root.');
      if (isProtectedRel(rel)) return block(`Removing ${rel} is not allowed in this run.`);
      if (ctx.projectDir.startsWith(canon(abs) + sep)) return block('Do not remove a folder that contains the repo.');
      if (rel === null && !safeOutside(abs, true) && !/\/Library\/Developer\/Xcode\/DerivedData\/.+/.test(abs)) {
        return block(`Removing ${t} (outside the repo) is not allowed. Temp directories and Xcode DerivedData are fine.`);
      }
    }
    return ok;
  }

  if (MUTATORS.has(prog)) {
    if (prog === 'sed' && !rest.some((t) => /^-[a-zA-Z]*i/.test(t))) return ok;
    if (prog === 'perl' && !rest.some((t) => /^-[a-zA-Z]*i/.test(t))) return ok;
    for (const t of positional(rest)) {
      const rel = relToProject(expand(t, ctx), ctx);
      if (isProtectedRel(rel)) return block(`Changing ${rel} is not allowed in this run. That file is changed by a person, through a pull request.`);
    }
  }
  return ok;
}

function checkExpo(args, seg) {
  const runsNative = args.some((t) => t === 'run:ios' || t === 'run:android');
  if (runsNative && args.some((t) => t === '--device' || t.startsWith('--device=') || t === '-d')) {
    return block('Installing on a real iPhone needs your Apple ID and signing. This run uses the Simulator only; the real-device step is in docs/ios/MORNING.md for the user.');
  }
  if (/\beas\b/.test(args[0] ?? '')) return block('EAS is not allowed in this run.');
  return ok;
}

function currentBranch(ctx) {
  if (ctx.branch !== undefined) return ctx.branch;
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ctx.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function checkGit(args, ctx) {
  // skip git's global options to find the subcommand
  let i = 0;
  while (i < args.length && isFlag(args[i])) i += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(args[i]) ? 2 : 1;
  const sub = args[i];
  const rest = args.slice(i + 1);
  if (sub === 'push') {
    if (rest.some((t) => /^(--force.*|-f|--delete|-d|--mirror|--all|--prune)$/.test(t) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(t))) {
      return block('No force pushes, deletes or mirror pushes.');
    }
    const pos = positional(rest.filter((t, k) => !(rest[k - 1] === '-o' || rest[k - 1] === '--push-option')));
    const branch = currentBranch(ctx);
    const dests = pos.length >= 2 ? pos.slice(1).map((r) => (r.includes(':') ? r.split(':')[1] : r)).map((r) => (r === 'HEAD' ? branch : r)) : [branch];
    const bad = dests.find((d) => !/^(refs\/heads\/)?ios\//.test(d));
    if (bad !== undefined) {
      return block(`Pushes are allowed only to branches named ios/..., never to main or anything else (this one would go to "${bad || 'an unknown branch'}"). Push with: git push -u origin ios/overnight`);
    }
    return ok;
  }
  if (sub === 'remote' && ['add', 'set-url', 'remove', 'rm', 'rename'].includes(rest[0])) return block('Do not change git remotes.');
  if (sub === 'config' && rest.some((t) => /credential|url\.|remote\./.test(t))) return block('Do not change git credentials or remotes.');
  if (['checkout', 'restore', 'apply', 'am', 'rm', 'mv'].includes(sub)) {
    for (const t of positional(rest)) {
      const rel = relToProject(expand(t, ctx), ctx);
      if (isProtectedRel(rel)) return block(`Changing ${rel} is not allowed in this run.`);
    }
  }
  return ok;
}

function checkGh(args) {
  const sub = args.filter((t) => !isFlag(t)).slice(0, 2).join(' ');
  if (args[0] === '--version' || GH_ALLOWED.has(sub)) return ok;
  return block(`\`gh ${sub}\` is not allowed. Allowed: pr create/view/list/status/checks/diff/comment/edit, run list/view/watch. Never merge, close or change repository settings.`);
}

// ── files ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function checkFileWrite(filePath, ctx) {
  const abs = expand(filePath, ctx);
  const rel = relToProject(abs, ctx);
  if (isProtectedRel(rel)) {
    return block(`${rel} is protected in this run. If the iPhone work needs a change there, write the proposal to docs/ios/PROPOSED_CHANGES.md (a migration goes in docs/ios/PROPOSED_MIGRATION.sql) and carry on.`);
  }
  if (rel === null && !safeOutside(abs)) return block(`Writing outside the repo (${filePath}) is not allowed. Use the repo or a temp directory.`);
  return ok;
}

// ── MCP tools ─────────────────────────────────────────────────────────────────────────────────────────────────────

const MIRO_OK = /^(board_create|board_show|board_get_space|board_search_boards|board_update_metadata|board_preview_read|canvas_.+|comment_.+|image_.+|section_create|section_update_metadata|space_list.*|table_.+|user_who_am_i|prototype_.+|record_ui_feedback|content_item_list_roles)$/;
const SUPABASE_READ = /^(list_tables|get_advisors|query_logs|get_project_url|get_publishable_keys|generate_typescript_types|get_project|list_extensions|search_docs|list_migrations|list_branches|get_organization|list_organizations|list_projects|list_edge_functions|get_edge_function)$/;
const GITHUB_OK = /^(create_pull_request|pull_request_read|get_file_contents|get_commit|get_me|issue_read|list_.+|search_.+|actions_get|actions_list|get_job_logs|get_check_run)$/;
const FIGMA_READ = /^(get_design_context|get_screenshot|get_metadata|get_figjam|search_design_system|get_variable_defs|get_libraries|whoami|get_figma_skill)$/;

export function checkMcp(toolName) {
  const i = toolName.lastIndexOf('__');
  const server = toolName.slice(5, i).toLowerCase();
  const tool = toolName.slice(i + 2);
  const allow = (cond) => (cond ? ok : block(`${toolName} is not on the allowlist for this run.`));
  if (server.includes('linear')) return allow(!tool.startsWith('delete_'));
  if (server.includes('miro')) return allow(MIRO_OK.test(tool));
  if (server.includes('supabase')) return allow(SUPABASE_READ.test(tool));
  if (server.includes('github')) return allow(GITHUB_OK.test(tool));
  if (server.includes('figma')) return allow(FIGMA_READ.test(tool));
  if (server.includes('firecrawl')) return allow(/^firecrawl_(search|scrape)$/.test(tool));
  return block(`${toolName} is not on the allowlist for this run (allowed: Linear, Miro, Supabase reads, GitHub pull requests, Figma reads). Nothing else is needed overnight.`);
}

// ── entry ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function check(input, ctx) {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};
  if (tool === 'Bash') return checkBash(String(args.command ?? ''), ctx);
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return checkFileWrite(String(args.file_path ?? ''), ctx);
  if (tool === 'NotebookEdit') return checkFileWrite(String(args.notebook_path ?? ''), ctx);
  if (tool.startsWith('mcp__')) return checkMcp(tool);
  return ok;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.env.INTUS_IOS_OVERNIGHT !== '1') process.exit(0);
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const cwd = input.cwd || process.cwd();
    const ctx = { cwd, projectDir: canon(process.env.CLAUDE_PROJECT_DIR || cwd) };
    const result = check(input, ctx);
    if (result.block) {
      process.stderr.write(`Blocked by the overnight guard: ${result.reason}\n`);
      process.exit(2);
    }
    process.exit(0);
  } catch (e) {
    process.stderr.write(`The overnight guard failed, so the call was blocked: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }
}
