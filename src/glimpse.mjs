import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARY = join(__dirname, 'glimpse');

class GlimpseWindow extends EventEmitter {
  #proc;
  #closed = false;
  #pendingHTML = null;

  constructor(proc, initialHTML) {
    super();
    this.#proc = proc;
    this.#pendingHTML = initialHTML;

    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

    rl.on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        this.emit('error', new Error(`Malformed protocol line: ${line}`));
        return;
      }

      switch (msg.type) {
        case 'ready':
          if (this.#pendingHTML) {
            // First ready = blank page loaded. Send the queued HTML.
            this.setHTML(this.#pendingHTML);
            this.#pendingHTML = null;
          } else {
            // Subsequent ready = user HTML loaded. Notify caller.
            this.emit('ready');
          }
          break;
        case 'message':
          this.emit('message', msg.data);
          break;
        case 'closed':
          if (!this.#closed) {
            this.#closed = true;
            this.emit('closed');
          }
          break;
        default:
          break;
      }
    });

    proc.on('error', (err) => this.emit('error', err));

    proc.on('exit', () => {
      if (!this.#closed) {
        this.#closed = true;
        this.emit('closed');
      }
    });
  }

  #write(obj) {
    this.#proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  send(js) {
    this.#write({ type: 'eval', js });
  }

  setHTML(html) {
    this.#write({ type: 'html', html: Buffer.from(html).toString('base64') });
  }

  close() {
    this.#write({ type: 'close' });
  }
}

export function open(html, options = {}) {
  if (!existsSync(BINARY)) {
    throw new Error(
      "Glimpse binary not found. Run 'npm run build' or 'swiftc src/glimpse.swift -o src/glimpse'"
    );
  }

  const args = [];
  if (options.width != null)  args.push('--width',  String(options.width));
  if (options.height != null) args.push('--height', String(options.height));
  if (options.title != null)  args.push('--title',  options.title);

  const proc = spawn(BINARY, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  return new GlimpseWindow(proc, html);
}
