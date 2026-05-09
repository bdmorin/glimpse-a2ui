#!/usr/bin/env node
// Visual-regression harness for a2glimpse.
//
// For each fixture under test/fixtures/<name>.jsonl:
//   1. Spawn `a2glimpse` in --test-mode with a unique title.
//   2. Dispatch the fixture messages over stdin.
//   3. Wait for a render-settle delay.
//   4. Use mcporter -> snap-happy to find the window by title and capture it.
//   5. Pixel-diff vs test/__snapshots__/<renderer-hash>/<name>.png via ImageMagick
//      `compare`. Fail if differing pixels exceed THRESHOLD_PERCENT.
//      Write the golden if --update is set.
//
// Mac-host targeted. Routes screenshot capture through the `mcporter` CLI
// (NOT a native MCP server). See knowledge/20260509-140000.polish-and-hardening-plan.plan.md.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const HOST_HTML = join(REPO_ROOT, 'src', 'a2glimpse-host.html');
const BINARY = join(REPO_ROOT, 'src', 'a2glimpse');
const FIXTURE_DIR = join(__dirname, 'fixtures');
const SNAPSHOT_ROOT = join(__dirname, '__snapshots__');

const FIXTURES = [
  'button-only',
  'card-text',
  'modal',
  'multiple-choice',
  'checkbox',
  'slider',
  'text-field-form',
  'tabs',
  'icon',
];

// Render-settle delay. Empirically generous; the renderer is local and fast.
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 10_000;

// Pixel-diff threshold: a fixture fails if more than this percent of pixels
// differ from the golden. Tune here — 0.1% is strict but tolerates sub-pixel
// AA jitter from window-server compositing.
const THRESHOLD_PERCENT = 0.1;

// Test-mode locked capture geometry. Swift's --test-mode locks the *content*
// area to 480x320, but snap-happy captures the whole window (including the
// titlebar). We crop the titlebar before comparing — the title bar contains
// traffic-light buttons whose hover/focus jitter is non-deterministic and not
// what we're testing. Update both numbers if you change the test-mode default
// size in a2glimpse.swift.
const EXPECTED_WIDTH = 480;
const EXPECTED_HEIGHT = 352; // full captured (incl. 32px titlebar)
const TITLEBAR_HEIGHT = 32;
const CONTENT_HEIGHT = EXPECTED_HEIGHT - TITLEBAR_HEIGHT;

// External tool: ImageMagick `compare` (no npm deps).
const COMPARE_BIN = '/opt/homebrew/bin/compare';
const IDENTIFY_BIN = '/opt/homebrew/bin/identify';

function rendererHash() {
  const buf = readFileSync(HOST_HTML);
  return createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function snapshotDir() {
  return join(SNAPSHOT_ROOT, rendererHash());
}

function parseArgs(argv) {
  const out = { update: false, only: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') out.update = true;
    else if (a === '--only') out.only = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node test/visual.mjs [--update] [--only <fixture>]');
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function runMcporter(args) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn('mcporter', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectP(
        new Error(
          `mcporter timeout after 30s: args=${JSON.stringify(args)} stderr=${stderr.slice(-400)}`
        )
      );
    }, 30_000);
    child.stdout.on('data', d => (stdout += d.toString()));
    child.stderr.on('data', d => (stderr += d.toString()));
    child.on('error', err => {
      clearTimeout(timer);
      rejectP(err);
    });
    child.on('exit', code => {
      clearTimeout(timer);
      if (code !== 0) {
        rejectP(
          new Error(
            `mcporter exit ${code}: args=${JSON.stringify(args)} stderr=${stderr.slice(-400)}`
          )
        );
        return;
      }
      resolveP(stdout);
    });
  });
}

async function findWindowIdByTitle(title) {
  const out = await runMcporter(['call', 'snap-happy.ListWindows', '--output', 'json']);
  const json = JSON.parse(out);
  const text = json?.content?.find(c => c.type === 'text')?.text ?? '';
  // Match `ID: 123 | App: ... | Title: <title>` lines exactly.
  const re = new RegExp(`^ID:\\s*(\\d+)\\s*\\|\\s*App:[^|]*\\|\\s*Title:\\s*${escapeRegex(title)}\\s*\\|`, 'm');
  const m = text.match(re);
  if (!m) return null;
  return Number(m[1]);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runCmd(bin, args, opts = {}) {
  return new Promise((resolveP) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolveP({ code: -1, stdout, stderr: stderr + `\n[timeout after 30s]` });
    }, 30_000);
    child.stdout.on('data', d => (stdout += d.toString()));
    child.stderr.on('data', d => (stderr += d.toString()));
    child.on('error', err => {
      clearTimeout(timer);
      resolveP({ code: -1, stdout, stderr: stderr + `\n${err.message}` });
    });
    child.on('exit', code => {
      clearTimeout(timer);
      resolveP({ code, stdout, stderr });
    });
  });
}

// Crop the titlebar off a captured PNG, in place. The titlebar contains
// traffic-light buttons whose hover/focus state jitters across runs (~262 px
// of noise that swamps the 0.1% threshold). Renderer content is what we test.
async function cropTitlebar(pngPath) {
  const r = await runCmd('/opt/homebrew/bin/magick', [
    pngPath,
    '-crop',
    `${EXPECTED_WIDTH}x${CONTENT_HEIGHT}+0+${TITLEBAR_HEIGHT}`,
    '+repage',
    pngPath,
  ]);
  if (r.code !== 0) {
    throw new Error(`magick crop failed (${r.code}): ${r.stderr.slice(-200)}`);
  }
}

async function pngDimensions(pngPath) {
  const r = await runCmd(IDENTIFY_BIN, ['-format', '%w %h', pngPath]);
  if (r.code !== 0) {
    throw new Error(`identify failed (${r.code}): ${r.stderr.slice(-200)}`);
  }
  const [w, h] = r.stdout.trim().split(/\s+/).map(Number);
  return { width: w, height: h };
}

// Pixel-diff via ImageMagick `compare -metric AE -fuzz 0%`.
// Returns { totalPixels, diffPixels, diffPercent, diffPath }.
async function compareImages(goldenPath, capturedPath, diffPath) {
  mkdirSync(dirname(diffPath), { recursive: true });
  // `compare -metric AE` writes the count to stderr and exits 1 if any pixels
  // differ (0 = identical, 1 = differ, 2 = error). We always want the diff PNG.
  const r = await runCmd(COMPARE_BIN, [
    '-metric', 'AE',
    '-fuzz', '0%',
    goldenPath,
    capturedPath,
    diffPath,
  ]);
  if (r.code !== 0 && r.code !== 1) {
    throw new Error(`compare failed (code=${r.code}): ${r.stderr.slice(-400)}`);
  }
  // `compare -metric AE` may emit either "<count>" or "<count> (<normalized>)".
  // Take the first integer-looking token.
  const m = r.stderr.match(/(\d+)/);
  const diffPixels = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(diffPixels)) {
    throw new Error(`compare: could not parse AE metric from stderr: "${r.stderr}"`);
  }
  const dim = await pngDimensions(goldenPath);
  const totalPixels = dim.width * dim.height;
  const diffPercent = (diffPixels / totalPixels) * 100;
  return { totalPixels, diffPixels, diffPercent, diffPath, width: dim.width, height: dim.height };
}

async function captureWindow(windowId, outDir) {
  // Clean any stale image so we deterministically identify the new one.
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  await runMcporter([
    'call',
    'snap-happy.TakeScreenshot',
    `windowId:${windowId}`,
    '--save-images',
    outDir,
    '--output',
    'json',
  ]);
  const files = readdirSync(outDir).filter(f => f.endsWith('.png'));
  if (files.length !== 1) {
    throw new Error(`Expected 1 PNG in ${outDir}, found ${files.length}`);
  }
  return join(outDir, files[0]);
}

function loadFixtureLines(name) {
  const path = join(FIXTURE_DIR, `${name}.jsonl`);
  return readFileSync(path, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

async function captureFixture(name, mode) {
  const title = `a2glimpse-vr-${name}`;
  const proc = spawn(BINARY, ['--test-mode', '--title', title], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, A2GLIMPSE_TEST_MODE: '1' },
  });

  let died = false;
  proc.on('exit', () => {
    died = true;
  });

  try {
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    const ready = new Promise((resolveP, rejectP) => {
      const timer = setTimeout(
        () => rejectP(new Error(`No 'ready' event within ${READY_TIMEOUT_MS}ms`)),
        READY_TIMEOUT_MS
      );
      rl.on('line', line => {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'ready') {
            clearTimeout(timer);
            resolveP();
          }
        } catch {
          // ignore non-JSON lines
        }
      });
      proc.on('exit', code => {
        clearTimeout(timer);
        rejectP(new Error(`a2glimpse exited (code=${code}) before 'ready'`));
      });
    });

    await ready;

    for (const line of loadFixtureLines(name)) {
      proc.stdin.write(line + '\n');
    }

    await sleep(SETTLE_MS);

    // Window-focus race hardening: capture, verify pixel size matches the
    // test-mode geometry, retry once if it doesn't. Cap at 1 retry — don't loop.
    let capturedPath;
    let attempt = 0;
    while (true) {
      const windowId = await findWindowIdByTitle(title);
      if (!windowId) {
        throw new Error(
          `Could not locate window with title "${title}" via snap-happy.ListWindows`
        );
      }
      const tmpDir = join(SNAPSHOT_ROOT, '.tmp', name);
      capturedPath = await captureWindow(windowId, tmpDir);
      const dim = await pngDimensions(capturedPath);
      // Window may render at 1x or 2x (Retina); accept either as long as it's
      // a multiple of expected.
      const wOk = dim.width === EXPECTED_WIDTH || dim.width === EXPECTED_WIDTH * 2;
      const hOk = dim.height === EXPECTED_HEIGHT || dim.height === EXPECTED_HEIGHT * 2;
      if (wOk && hOk) break;
      if (attempt >= 1) {
        throw new Error(
          `Captured window size ${dim.width}x${dim.height} does not match expected ` +
          `${EXPECTED_WIDTH}x${EXPECTED_HEIGHT} (or 2x) after retry`
        );
      }
      console.error(
        `  ! ${name}: captured ${dim.width}x${dim.height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}; retrying once`
      );
      attempt += 1;
      await sleep(500);
    }

    // Crop the captured PNG to content area (drop titlebar) so the goldens
    // and comparisons exclude window-chrome jitter.
    await cropTitlebar(capturedPath);

    const goldenPath = join(snapshotDir(), `${name}.png`);

    if (mode === 'update') {
      mkdirSync(dirname(goldenPath), { recursive: true });
      copyFileSync(capturedPath, goldenPath);
      const size = statSync(goldenPath).size;
      console.log(`  ✓ ${name}: wrote golden (${size} bytes) -> ${goldenPath}`);
      return { name, ok: true };
    }

    if (!existsSync(goldenPath)) {
      console.error(`  ✗ ${name}: no golden at ${goldenPath} (run with --update first)`);
      return { name, ok: false, reason: 'missing-golden' };
    }

    const diffPath = join(snapshotDir(), 'diffs', `${name}.diff.png`);
    const result = await compareImages(goldenPath, capturedPath, diffPath);
    const pass = result.diffPercent <= THRESHOLD_PERCENT;
    const verdict = pass ? 'PASS' : 'FAIL';
    const pct = result.diffPercent.toFixed(4);
    console.log(
      `  ${pass ? '✓' : '✗'} ${name}: ${result.diffPixels} / ${result.totalPixels} = ${pct}% [${verdict}]`
    );
    if (!pass) {
      const actualPath = join(snapshotDir(), `${name}.actual.png`);
      copyFileSync(capturedPath, actualPath);
      console.error(`     diff -> ${diffPath}`);
      console.error(`     actual -> ${actualPath}`);
      return { name, ok: false, reason: `pixel-diff ${pct}% > ${THRESHOLD_PERCENT}%` };
    }
    return { name, ok: true };
  } finally {
    if (!died) {
      try {
        proc.stdin.write(JSON.stringify({ type: 'close' }) + '\n');
      } catch {}
      await new Promise(r => {
        const t = setTimeout(() => {
          proc.kill('SIGKILL');
          r();
        }, 2000);
        proc.on('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(BINARY)) {
    console.error(`a2glimpse binary not found at ${BINARY}. Run npm run build:macos.`);
    process.exit(1);
  }
  const hash = rendererHash();
  console.log(`a2glimpse visual harness — renderer hash: ${hash}`);
  console.log(`mode: ${args.update ? 'update goldens' : `compare pixel-diff (threshold ${THRESHOLD_PERCENT}%)`}`);
  console.log(`snapshot dir: ${snapshotDir()}\n`);

  const targets = args.only ? [args.only] : FIXTURES;
  const results = [];
  for (const name of targets) {
    if (!FIXTURES.includes(name)) {
      console.error(`Unknown fixture: ${name}`);
      process.exit(2);
    }
    try {
      const r = await captureFixture(name, args.update ? 'update' : 'compare');
      results.push(r);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      results.push({ name, ok: false, reason: err.message });
    }
  }

  // Clean tmp dir.
  const tmp = join(SNAPSHOT_ROOT, '.tmp');
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });

  const fails = results.filter(r => !r.ok);
  console.log('');
  if (fails.length === 0) {
    console.log(`All ${results.length} fixture(s) ${args.update ? 'updated' : 'matched'}.`);
    process.exit(0);
  }
  console.error(`${fails.length}/${results.length} fixture(s) failed:`);
  for (const f of fails) console.error(`  - ${f.name}: ${f.reason}`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
