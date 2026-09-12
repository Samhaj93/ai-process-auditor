"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * State backed by sessionStorage — cleared when the tab closes, never written
 * to disk, never sent anywhere but the analysis request itself.
 *
 * useSyncExternalStore rather than useState + useEffect: sessionStorage is an
 * external store, the server snapshot is empty by definition, and React handles
 * the hydration step without a mismatch or a setState-in-effect.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function read(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    // Private mode or blocked storage. The field still works for this session.
    return "";
  }
}

export function useSessionState(key: string): [string, (value: string) => void] {
  const getSnapshot = useCallback(() => read(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "");

  const setValue = useCallback(
    (next: string) => {
      try {
        if (next) window.sessionStorage.setItem(key, next);
        else window.sessionStorage.removeItem(key);
      } catch {
        // ignored, as above
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, setValue];
}
