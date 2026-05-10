// WKWebView bridge — Swift ↔ renderer.
// Inbound: Swift calls `window.a2glimpse.dispatch(message)` with A2UI JSON.
// Outbound: actions, content-size pings, and ready signal go to
// `window.webkit.messageHandlers.glimpse.postMessage(json)`.

import { store } from './store';
import type { Action } from './schema';

declare global {
  interface Window {
    a2glimpse?: {
      dispatch: (message: unknown) => void;
    };
    webkit?: {
      messageHandlers?: {
        glimpse?: {
          postMessage: (msg: string) => void;
        };
      };
    };
  }
}

const post = (payload: unknown): void => {
  try {
    window.webkit?.messageHandlers?.glimpse?.postMessage(JSON.stringify(payload));
  } catch {
    /* preview / non-WKWebView; swallow */
  }
};

export const installBridge = (): void => {
  window.a2glimpse = {
    dispatch: (message) => {
      store.dispatch(message as never);
    },
  };
  // Swift waits for this magic postMessage before flushing queued
  // surfaceUpdate / dataModelUpdate / beginRendering messages. Without
  // it, anything dispatched before the page navigation finished is
  // dropped on the floor.
  post({ __a2glimpse_host_ready: true });
  window.dispatchEvent(new CustomEvent('a2glimpse-host-ready'));
};

export const dispatchAction = (
  surfaceId: string,
  sourceComponentId: string,
  action: Action,
  data: Record<string, unknown>,
): void => {
  const ctx: Record<string, unknown> = {};
  for (const c of action.context ?? []) {
    if ('literalString' in c.value) ctx[c.key] = c.value.literalString;
    else if ('path' in c.value) ctx[c.key] = data[c.value.path.replace(/^\//, '')];
  }
  post({
    userAction: {
      name: action.name,
      surfaceId,
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context: ctx,
    },
  });
};

// Auto-grow ping. Same wire shape as the Lit host so Swift code unchanged.
let lastH = 0;
let lastW = 0;
export const reportContentSize = (height: number, width: number): void => {
  if (height === lastH && width === lastW) return;
  lastH = height;
  lastW = width;
  post({ __a2glimpse_resize_to_content: true, height, width });
};
