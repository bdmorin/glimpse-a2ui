// In-memory store for surfaces + data models, plus a tiny pub/sub so React
// re-renders when an incoming dispatch lands. Two-message round-trip:
// (1) Swift posts a JSON message via window.a2glimpse.dispatch. (2) the
// store updates and notifies subscribers. (3) React re-reads via useSync.

import type {
  ComponentNode,
  DataModelEntry,
  IncomingMessage,
  Surface,
} from './schema';

export type DataModel = Record<string, string | number | boolean | unknown[]>;

export type SurfaceState = {
  components: Map<string, ComponentNode>;
  data: DataModel;
  rootId: string | null;
};

class A2UIStore {
  private surfaces = new Map<string, SurfaceState>();
  private visibleStack: string[] = [];
  private subscribers = new Set<() => void>();
  // Stable snapshot reference — replaced only on notify so
  // useSyncExternalStore's Object.is check doesn't thrash.
  private snapshot: { surfaces: Map<string, SurfaceState>; visible: string[] } = {
    surfaces: this.surfaces,
    visible: this.visibleStack,
  };

  subscribe = (fn: () => void): (() => void) => {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  };

  private notify = () => {
    this.snapshot = { surfaces: this.surfaces, visible: this.visibleStack };
    for (const fn of this.subscribers) fn();
  };

  getSnapshot = (): { surfaces: Map<string, SurfaceState>; visible: string[] } => {
    return this.snapshot;
  };

  dispatch = (msg: IncomingMessage): void => {
    if ('surfaceUpdate' in msg) {
      this.applySurfaceUpdate(msg.surfaceUpdate);
    } else if ('dataModelUpdate' in msg) {
      this.applyDataModelUpdate(
        msg.dataModelUpdate.surfaceId,
        msg.dataModelUpdate.contents,
      );
    } else if ('beginRendering' in msg) {
      this.beginRendering(msg.beginRendering.surfaceId, msg.beginRendering.root);
    } else if ('deleteSurface' in msg) {
      this.deleteSurface(msg.deleteSurface.surfaceId);
    }
    this.notify();
  };

  // Update — replace whole component tree for surface, preserve data.
  private applySurfaceUpdate = (surface: Surface) => {
    const existing = this.surfaces.get(surface.surfaceId);
    const components = new Map<string, ComponentNode>();
    for (const node of surface.components) components.set(node.id, node);
    this.surfaces.set(surface.surfaceId, {
      components,
      data: existing?.data ?? {},
      rootId: existing?.rootId ?? null,
    });
  };

  private applyDataModelUpdate = (
    surfaceId: string,
    contents: DataModelEntry[],
  ) => {
    let state = this.surfaces.get(surfaceId);
    if (!state) {
      state = { components: new Map(), data: {}, rootId: null };
      this.surfaces.set(surfaceId, state);
    }
    for (const entry of contents) {
      if ('valueString' in entry) state.data[entry.key] = entry.valueString;
      else if ('valueNumber' in entry) state.data[entry.key] = entry.valueNumber;
      else if ('valueBoolean' in entry) state.data[entry.key] = entry.valueBoolean;
      else if ('valueArray' in entry) state.data[entry.key] = entry.valueArray;
    }
  };

  private beginRendering = (surfaceId: string, rootId: string) => {
    const state = this.surfaces.get(surfaceId);
    if (!state) return;
    state.rootId = rootId;
    if (!this.visibleStack.includes(surfaceId)) {
      this.visibleStack = [...this.visibleStack, surfaceId];
    }
  };

  private deleteSurface = (surfaceId: string) => {
    this.surfaces.delete(surfaceId);
    this.visibleStack = this.visibleStack.filter((id) => id !== surfaceId);
  };

  // User input writes back into the data model and notifies.
  setDataValue = (
    surfaceId: string,
    key: string,
    value: string | number | boolean | unknown[],
  ): void => {
    const state = this.surfaces.get(surfaceId);
    if (!state) return;
    state.data[key] = value;
    this.notify();
  };
}

export const store = new A2UIStore();
