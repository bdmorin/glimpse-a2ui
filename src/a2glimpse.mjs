import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFollowCursorSupport, supportsFollowCursor } from './follow-cursor-support.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveNativeHost() {
  const override = process.env.A2GLIMPSE_BINARY_PATH || process.env.GLIMPSE_BINARY_PATH;
  if (override) {
    return {
      path: isAbsolute(override) ? override : resolve(process.cwd(), override),
      platform: 'override',
      buildHint: `Using override: ${override}`,
    };
  }

  if (process.platform !== 'darwin') {
    throw new Error(`a2glimpse POC currently supports macOS only (current platform: ${process.platform}).`);
  }

  return {
    path: join(__dirname, 'a2glimpse'),
    platform: 'darwin',
    buildHint: "Run 'npm run build:macos' or 'swiftc -O src/a2glimpse.swift -o src/a2glimpse'",
  };
}

export function getNativeHostInfo() {
  return resolveNativeHost();
}

export { getFollowCursorSupport, supportsFollowCursor };

class A2GlimpseWindow extends EventEmitter {
  #proc;
  #closed = false;
  #ready = false;
  #pending = [];
  #info = null;

  constructor(proc) {
    super();
    this.#proc = proc;
    proc.stdin.on('error', () => {});

    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rl.on('line', line => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.emit('error', new Error(`Malformed protocol line: ${line}`));
        return;
      }

      switch (msg.type) {
        case 'ready':
        case 'info': {
          const info = {
            screen: msg.screen,
            screens: msg.screens,
            appearance: msg.appearance,
            cursor: msg.cursor,
            cursorTip: msg.cursorTip ?? null,
          };
          this.#info = info;
          if (msg.type === 'ready') {
            this.#ready = true;
            for (const pending of this.#pending.splice(0)) this.#write(pending);
          }
          this.emit(msg.type, info);
          break;
        }
        case 'click':
          this.emit('click');
          break;
        case 'closed':
          this.#markClosed();
          break;
        default:
          if (msg.userAction) this.emit('userAction', msg.userAction);
          else if (msg.error) this.emit('clientError', msg.error);
          else this.emit('protocol', msg);
          break;
      }
    });

    proc.on('error', err => this.emit('error', err));
    proc.on('exit', () => this.#markClosed());
  }

  #markClosed() {
    if (this.#closed) return;
    this.#closed = true;
    this.emit('closed');
  }

  #write(obj) {
    if (this.#closed) return;
    this.#proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  dispatch(message) {
    if (!this.#ready) {
      this.#pending.push(message);
      return;
    }
    this.#write(message);
  }

  send(message) {
    this.dispatch(message);
  }

  close() {
    this.#write({ type: 'close' });
  }

  get info() {
    return this.#info;
  }

  getInfo() {
    this.#write({ type: 'get-info' });
  }

  show(options = {}) {
    const msg = { type: 'show' };
    if (options.title != null) msg.title = options.title;
    this.#write(msg);
  }

  setTitle(title) {
    this.#write({ type: 'title', title });
  }

  resize(width, height) {
    this.#write({ type: 'resize', width, height });
  }

  followCursor(enabled, anchor, mode) {
    if (enabled && !supportsFollowCursor()) {
      const { reason } = getFollowCursorSupport();
      process.emitWarning(`followCursor disabled: ${reason}`, { code: 'A2GLIMPSE_FOLLOW_CURSOR_UNSUPPORTED' });
      return;
    }
    const msg = { type: 'follow-cursor', enabled };
    if (anchor !== undefined) msg.anchor = anchor;
    if (mode !== undefined) msg.mode = mode;
    this.#write(msg);
  }

  /** @internal test hook for the POC smoke test. */
  _testClick(id) {
    this.#write({ type: '__test-click', id });
  }
}

function ensureBinary() {
  const host = resolveNativeHost();
  if (!existsSync(host.path)) {
    const skippedBuildPath = join(__dirname, '..', '.a2glimpse-build-skipped');
    const skippedReason = existsSync(skippedBuildPath)
      ? readFileSync(skippedBuildPath, 'utf8').trim()
      : null;
    throw new Error(
      skippedReason
        ? `a2glimpse host not found at '${host.path}'. ${skippedReason}`
        : `a2glimpse host not found at '${host.path}'. ${host.buildHint}`
    );
  }
  return host;
}

export function open(options = {}) {
  const host = ensureBinary();

  const args = [];
  if (options.width != null) args.push('--width', String(options.width));
  if (options.height != null) args.push('--height', String(options.height));
  if (options.title != null) args.push('--title', options.title);
  if (options.frameless) args.push('--frameless');
  if (options.floating) args.push('--floating');
  if (options.transparent) args.push('--transparent');
  if (options.clickThrough) args.push('--click-through');
  if (options.noDock) args.push('--no-dock');
  if (options.hidden) args.push('--hidden');
  if (options.autoClose) args.push('--auto-close');
  if (options.openLinks) args.push('--open-links');
  if (options.openLinksApp) args.push('--open-links-app', options.openLinksApp);
  if (options.followCursor && supportsFollowCursor()) args.push('--follow-cursor');
  if (options.x != null) args.push(`--x=${options.x}`);
  if (options.y != null) args.push(`--y=${options.y}`);
  if (options.cursorOffset?.x != null) args.push(`--cursor-offset-x=${options.cursorOffset.x}`);
  if (options.cursorOffset?.y != null) args.push(`--cursor-offset-y=${options.cursorOffset.y}`);
  if (options.cursorAnchor) args.push('--cursor-anchor', options.cursorAnchor);
  if (options.followMode != null) args.push('--follow-mode', options.followMode);
  if (options.statusItem) args.push('--status-item');

  const proc = spawn(host.path, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  return new A2GlimpseWindow(proc);
}
