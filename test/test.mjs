import { open } from '../src/a2glimpse.mjs';

const TIMEOUT_MS = 10_000;

const messages = [
  {
    surfaceUpdate: {
      surfaceId: 'smoke',
      components: [
        { id: 'root', component: { Column: { children: { explicitList: ['title', 'button'] } } } },
        { id: 'title', component: { Text: { usageHint: 'h3', text: { literalString: 'a2glimpse smoke' } } } },
        { id: 'button_text', component: { Text: { text: { literalString: 'Confirm' } } } },
        {
          id: 'button',
          component: {
            Button: {
              child: 'button_text',
              primary: true,
              action: {
                name: 'smoke.confirm',
                context: [{ key: 'answer', value: { literalString: 'yes' } }],
              },
            },
          },
        },
      ],
    },
  },
  { dataModelUpdate: { surfaceId: 'smoke', contents: [] } },
  { beginRendering: { surfaceId: 'smoke', root: 'root' } },
];

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

function waitFor(emitter, event, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for '${event}' after ${timeoutMs}ms`));
    }, timeoutMs);

    emitter.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });

    emitter.once('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

console.log('a2glimpse integration smoke test\n');

let win;
try {
  // testMode: required to enable the synthetic-click (`_testClick`) path —
  // gated in the Swift dispatcher (Phase 2b). Without it `__test-click` is
  // rejected as an unknown command.
  win = open({ title: 'a2glimpse test', width: 420, height: 260, hidden: true, testMode: true });
  pass('Window opened');

  await waitFor(win, 'ready');
  pass('ready event received');

  for (const message of messages) win.dispatch(message);
  pass('A2UI fixture dispatched');

  win._testClick('button');
  const [action] = await waitFor(win, 'userAction');
  if (action?.name !== 'smoke.confirm') fail(`Expected smoke.confirm, got ${JSON.stringify(action)}`);
  if (action?.surfaceId !== 'smoke') fail(`Expected surfaceId smoke, got ${JSON.stringify(action)}`);
  if (action?.sourceComponentId !== 'button') fail(`Expected sourceComponentId button, got ${JSON.stringify(action)}`);
  if (action?.context?.answer !== 'yes') fail(`Expected context.answer yes, got ${JSON.stringify(action)}`);
  pass(`userAction received: ${JSON.stringify(action)}`);

  win.getInfo();
  await waitFor(win, 'info');
  pass('info event received');

  win.dispatch({ nope: true });
  await waitFor(win, 'clientError');
  pass('invalid protocol input reported as error');

  win.close();
  await waitFor(win, 'closed');
  pass('closed event received');

  console.log('\nAll tests passed');
  process.exit(0);
} catch (err) {
  console.error(`\n  ✗ ${err.message}`);
  win?.close();
  process.exit(1);
}
