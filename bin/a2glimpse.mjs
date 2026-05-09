#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { open } from '../src/a2glimpse.mjs';

const args = process.argv.slice(2);
const flags = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') flags.help = true;
  else if (arg === '--demo') flags.demo = true;
  else if (arg === '--frameless') flags.frameless = true;
  else if (arg === '--floating') flags.floating = true;
  else if (arg === '--transparent') flags.transparent = true;
  else if (arg === '--click-through') flags.clickThrough = true;
  else if (arg === '--follow-cursor') flags.followCursor = true;
  else if (arg === '--auto-close') flags.autoClose = true;
  else if (arg === '--width' && args[i + 1]) flags.width = parseInt(args[++i], 10);
  else if (arg === '--height' && args[i + 1]) flags.height = parseInt(args[++i], 10);
  else if (arg === '--title' && args[i + 1]) flags.title = args[++i];
  else if (arg === '--x' && args[i + 1]) flags.x = parseInt(args[++i], 10);
  else if (arg === '--y' && args[i + 1]) flags.y = parseInt(args[++i], 10);
  else {
    console.error(`Unknown flag: ${arg}`);
    process.exit(1);
  }
}

if (flags.help) {
  console.log(`
a2glimpse — Native A2UI v0.8 POC appliance

Usage:
  a2glimpse [options]              Read A2UI JSONL from stdin
  a2glimpse --demo                 Render a tiny demo surface

Options:
  --width <n>        Window width (default: 800)
  --height <n>       Window height (default: 600)
  --title <text>     Window title (default: "a2glimpse")
  --frameless        No title bar
  --floating         Always on top
  --transparent      Transparent background
  --click-through    Mouse passes through
  --follow-cursor    Window follows cursor
  --auto-close       Close after first userAction/error
  --x <n>            Window X position
  --y <n>            Window Y position
  --demo             Show a minimal A2UI demo
  --help, -h         Show this help
`);
  process.exit(0);
}

const demoMessages = [
  {
    surfaceUpdate: {
      surfaceId: 'demo',
      components: [
        { id: 'root', component: { Column: { children: { explicitList: ['title', 'button'] } } } },
        { id: 'title', component: { Text: { usageHint: 'h3', text: { literalString: 'a2glimpse POC' } } } },
        { id: 'button_text', component: { Text: { text: { literalString: 'Send userAction' } } } },
        { id: 'button', component: { Button: { child: 'button_text', primary: true, action: { name: 'demo.clicked', context: [{ key: 'source', value: { literalString: 'demo' } }] } } } },
      ],
    },
  },
  { dataModelUpdate: { surfaceId: 'demo', contents: [] } },
  { beginRendering: { surfaceId: 'demo', root: 'root' } },
];

const win = open(flags);

win.on('ready', () => {
  if (flags.demo) {
    for (const msg of demoMessages) win.dispatch(msg);
  }
});

win.on('userAction', action => {
  console.log(JSON.stringify({ userAction: action }));
});

win.on('clientError', error => {
  console.log(JSON.stringify({ error }));
});

win.on('closed', () => process.exit(0));
win.on('error', err => {
  console.error(err.message);
  process.exit(1);
});

if (!flags.demo) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      win.dispatch(JSON.parse(trimmed));
    } catch {
      console.error(`Skipping invalid JSONL input: ${trimmed}`);
    }
  });
}
