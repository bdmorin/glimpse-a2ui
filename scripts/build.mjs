import { spawnSync } from 'node:child_process';

const target = process.argv[2] || process.platform;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, extraOptions = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...extraOptions });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

switch (target) {
  case 'darwin':
    run('swiftc', ['-O', 'src/glimpse.swift', '-o', 'src/a2glimpse']);
    break;

  case 'linux':
  case 'win32':
    fail('a2glimpse POC is macOS-only for now.');
    break;

  default:
    fail(`Unsupported build target: ${target}`);
}
