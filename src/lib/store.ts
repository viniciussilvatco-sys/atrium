import { useSyncExternalStore } from "react";

/** Pequeno estado global persistido no localStorage (preferências deste aparelho). */
export function createPersistedStore<T>(key: string, initial: T) {
  let value: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw);
  } catch {
    /* usa o valor inicial */
  }
  const listeners = new Set<() => void>();
  const store = {
    get: () => value,
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* armazenamento indisponível */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return store;
}

export function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export type ThemePref = "light" | "dark" | "system";
export const themeStore = createPersistedStore<ThemePref>("atrium.theme", "system");
export const currentProfileStore = createPersistedStore<string | null>("atrium.profile", null);
export const sidebarStore = createPersistedStore<{ width: number; collapsed: boolean; expanded: Record<string, boolean> }>(
  "atrium.sidebar",
  { width: 260, collapsed: false, expanded: {} },
);
export const onboardedStore = createPersistedStore<boolean>("atrium.onboarded", false);

// ---------- Rota (#/<pageId>) ----------

function readHash(): string | null {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h || null;
}

let route = readHash();
const routeListeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  route = readHash();
  routeListeners.forEach((l) => l());
});

export const routeStore = {
  get: () => route,
  subscribe(l: () => void) {
    routeListeners.add(l);
    return () => routeListeners.delete(l);
  },
};

export function navigate(pageId: string | null) {
  window.location.hash = pageId ? `/${pageId}` : "/";
}

// ---------- Tema efetivo ----------

const media = window.matchMedia("(prefers-color-scheme: dark)");
const themeListeners = new Set<() => void>();
media.addEventListener("change", () => themeListeners.forEach((l) => l()));
themeStore.subscribe(() => themeListeners.forEach((l) => l()));

export const effectiveThemeStore = {
  get: (): "light" | "dark" => {
    const pref = themeStore.get();
    return pref === "system" ? (media.matches ? "dark" : "light") : pref;
  },
  subscribe(l: () => void) {
    themeListeners.add(l);
    return () => themeListeners.delete(l);
  },
};

// ---------- Estado de interface (não persistido) ----------

export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type ModalName = "search" | "settings" | "trash" | "templates" | "conflicts" | null;
export const modalStore = createStore<ModalName>(null);
export const mobileSidebarStore = createStore<boolean>(false);

export function openModal(name: ModalName) {
  modalStore.set(name);
  mobileSidebarStore.set(false);
}
