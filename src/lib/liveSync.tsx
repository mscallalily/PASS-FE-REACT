import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from './apiClient';
import { useAuth } from '../context/AuthContext';

// Shared refresh for every PASS screen. One small request (/api/sync/revision)
// returns a change marker per topic; screens reload their own data only when a
// topic they show has changed. This is coordinated polling, not hardware-level
// real time: changes made by other staff appear within about POLL_MS.
//
//   - every POLL_MS while the tab is visible
//   - every HIDDEN_POLL_MS while the tab is hidden; checked immediately on return / focus
//   - checked immediately after this user's own actions (refreshNow)
//   - on network errors the last data stays on screen and polling backs off

export type Topic = 'parking' | 'visitors' | 'violations' | 'vehicles' | 'notifications';

export const POLL_MS = 5000;
const ERROR_POLL_MS = 15000;
/** Background tabs still catch up, just rarely. */
const HIDDEN_POLL_MS = 60000;

interface LiveSync {
  /** Bumped each time a topic changes; screens depend on the topics they show. */
  versions: Record<Topic, number>;
  /** Check for changes now (call after a successful mutation). */
  refreshNow: () => void;
  /** True while the latest check failed (data on screen may be stale). */
  offline: boolean;
}

const zero: Record<Topic, number> = { parking: 0, visitors: 0, violations: 0, vehicles: 0, notifications: 0 };
const LiveSyncContext = createContext<LiveSync>({ versions: zero, refreshNow: () => {}, offline: false });

export function LiveSyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [versions, setVersions] = useState(zero);
  const [offline, setOffline] = useState(false);
  const markers = useRef<Partial<Record<Topic, string>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) { queued.current = true; return; }
    inFlight.current = true;
    let failed = false;
    try {
      const { topics } = await apiRequest<{ topics: Partial<Record<Topic, string>> }>('/api/sync/revision');
      const changed = (Object.keys(topics) as Topic[]).filter(t => markers.current[t] !== undefined && markers.current[t] !== topics[t]);
      markers.current = { ...markers.current, ...topics };
      if (changed.length) setVersions(v => { const next = { ...v }; changed.forEach(t => { next[t] += 1; }); return next; });
      setOffline(false);
    } catch {
      failed = true;
      setOffline(true);
    } finally {
      inFlight.current = false;
    }

    if (timer.current) clearTimeout(timer.current);
    if (queued.current) { queued.current = false; void check(); return; }
    const visible = document.visibilityState === 'visible';
    timer.current = setTimeout(() => void check(), failed ? ERROR_POLL_MS : visible ? POLL_MS : HIDDEN_POLL_MS);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    markers.current = {};
    void check();
    // Back in view: check at once (this also restores the fast interval).
    const wake = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isAuthenticated, check]);

  const refreshNow = useCallback(() => { void check(); }, [check]);

  return <LiveSyncContext.Provider value={{ versions, refreshNow, offline }}>{children}</LiveSyncContext.Provider>;
}

export function useLiveSync() {
  return useContext(LiveSyncContext);
}

/** A key that changes whenever any of the given topics changes. */
export function useTopicVersion(topics: Topic[]) {
  const { versions } = useLiveSync();
  return topics.map(t => versions[t]).join('-');
}

/**
 * Load data now, again when `load` changes (filters), and whenever one of the
 * topics changes. Errors keep the last data; nothing is invented.
 */
export function useLiveLoad<T>(load: () => Promise<T>, topics: Topic[], onData: (data: T) => void, onError: (message: string) => void) {
  const version = useTopicVersion(topics);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  onDataRef.current = onData;
  onErrorRef.current = onError;

  const run = useCallback(async () => {
    try {
      onDataRef.current(await load());
      onErrorRef.current('');
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : 'Unable to load data.');
    }
  }, [load]);

  useEffect(() => { void run(); }, [run, version]);

  return run;
}
