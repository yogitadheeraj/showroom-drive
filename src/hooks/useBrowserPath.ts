import { useSyncExternalStore } from 'react';

const getCurrentPath = () => {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const listeners = new Set<() => void>();
let historyPatched = false;

const notify = () => {
  listeners.forEach((listener) => listener());
};

const ensureHistoryPatch = () => {
  if (historyPatched || typeof window === 'undefined') return;

  historyPatched = true;

  const { pushState, replaceState } = window.history;

  window.history.pushState = function pushStateWithNotify(...args) {
    const result = pushState.apply(this, args);
    notify();
    return result;
  };

  window.history.replaceState = function replaceStateWithNotify(...args) {
    const result = replaceState.apply(this, args);
    notify();
    return result;
  };

  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  ensureHistoryPatch();

  return () => {
    listeners.delete(listener);
  };
};

const useBrowserPath = () => useSyncExternalStore(subscribe, getCurrentPath, () => '/');

export default useBrowserPath;