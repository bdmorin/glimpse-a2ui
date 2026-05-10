// Build the React/Tailwind/shadcn renderer and copy the single-file
// output to src/a2glimpse-host.html (and dist/.app/Contents/Resources
// if the .app bundle exists). The Swift host's loadFileURL path is
// unchanged from the Lit-era host — only the contents are different.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repo = resolve(__dirname, '..');

const log = (msg) => console.log(`[build-renderer] ${msg}`);

// 1. Build the Vite project.
const result = spawnSync('npm', ['run', 'build'], {
  cwd: join(repo, 'renderer'),
  stdio: 'inherit',
  shell: false,
});
if (result.status !== 0) process.exit(result.status ?? 1);

// 2. Copy the single-file bundle to where Swift expects it.
const bundle = join(repo, 'renderer', 'dist', 'index.html');
if (!existsSync(bundle)) {
  console.error(`[build-renderer] missing bundle: ${bundle}`);
  process.exit(1);
}
const target = join(repo, 'src', 'a2glimpse-host.html');
copyFileSync(bundle, target);
log(`copied bundle → ${target}`);

// 3. If the .app bundle exists (build:app already ran), refresh its
//    Resources copy too. Otherwise build:app will pick up the new src
//    on its next run.
const appResources = join(repo, 'dist', 'a2glimpse.app', 'Contents', 'Resources');
if (existsSync(appResources)) {
  copyFileSync(bundle, join(appResources, 'a2glimpse-host.html'));
  log(`refreshed .app bundle copy`);
} else {
  mkdirSync(join(repo, 'dist'), { recursive: true });
}
