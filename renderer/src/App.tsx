import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { installBridge, reportContentSize } from './a2ui/bridge';
import { store } from './a2ui/store';
import { SurfaceWithId } from './a2ui/Renderer';

function App() {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const stackRef = useRef<HTMLDivElement | null>(null);

  // Install the WKWebView bridge once.
  useEffect(() => {
    installBridge();
  }, []);

  // Auto-grow ping. Measure the stack's own bounding box so the window
  // shrinks back when content shrinks — documentElement.scrollHeight
  // ratchets up to viewport floor and never decreases, leaving phantom
  // empty space at the bottom of tall windows.
  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(document.body);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      const padLeft = parseFloat(cs.paddingLeft) || 0;
      const padRight = parseFloat(cs.paddingRight) || 0;
      reportContentSize(
        Math.ceil(rect.height + padTop + padBottom),
        Math.ceil(rect.width + padLeft + padRight),
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  });

  return (
    <div ref={stackRef} className="flex flex-col gap-4">
      {snapshot.visible.map((sid) => {
        const surface = snapshot.surfaces.get(sid);
        if (!surface) return null;
        return <SurfaceWithId key={sid} surfaceId={sid} surface={surface} />;
      })}
    </div>
  );
}

export default App;
