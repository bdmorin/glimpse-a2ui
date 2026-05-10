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

  // Auto-grow ping. ResizeObserver on the stack root posts content size
  // to Swift after every layout pass.
  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      const w = Math.ceil(document.documentElement.scrollWidth);
      reportContentSize(h, w);
    });
    ro.observe(el);
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
