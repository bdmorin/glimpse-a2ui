import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildScript = join(__dirname, 'build.mjs');
const skippedBuildMarker = join(__dirname, '..', '.a2glimpse-build-skipped');

function hasCommand(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return !result.error && result.status === 0;
}

rmSync(skippedBuildMarker, { force: true });

if (process.platform === 'darwin' && !hasCommand('swiftc')) {
  const message = 'Postinstall skipped native build because swiftc was not found. Install Xcode Command Line Tools, then run npm run build:macos.';
  writeFileSync(skippedBuildMarker, message + '\n');
  console.warn(`[a2glimpse] ${message}`);
  process.exit(0);
}

if (process.platform !== 'darwin') {
  const message = `Postinstall skipped native build because a2glimpse POC currently supports macOS only (current platform: ${process.platform}).`;
  writeFileSync(skippedBuildMarker, message + '\n');
  console.warn(`[a2glimpse] ${message}`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [buildScript], { stdio: 'inherit' });
process.exit(result.status ?? 1);
