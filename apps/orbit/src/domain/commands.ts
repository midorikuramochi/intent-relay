import { createInitialOrbitState, reduceOrbit } from "./reducer";
import { loadOrbitState, saveOrbitState } from "./storage";
import type { OrbitActor, OrbitCommand, OrbitState } from "./types";

export type { OrbitCommand } from "./types";

export interface OrbitStore {
  getState(): OrbitState;
  subscribe(listener: () => void): () => void;
  dispatchOrbitCommand(command: OrbitCommand, actor: OrbitActor): OrbitState;
}

export function createOrbitStore(options: {
  demoSessionId: string;
  storage: Storage;
  now?: () => string;
}): OrbitStore {
  const now = options.now ?? (() => new Date().toISOString());
  let state =
    loadOrbitState(options.storage, options.demoSessionId) ??
    createInitialOrbitState(options.demoSessionId);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatchOrbitCommand(command, actor) {
      state = reduceOrbit(state, { ...command, actor, now: now() });
      saveOrbitState(options.storage, state);
      for (const listener of listeners) {
        listener();
      }
      return state;
    },
  };
}
