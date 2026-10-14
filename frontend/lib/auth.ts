// Sign-in session kept in the browser (token issued by the backend, see backend/api/auth.py).
// Storage can be unavailable (private mode, blocked site data): every access is guarded.

const KEY = "gamota-copilot-session";

export interface Session {
  token: string;
  username: string;
  expires_at: number; // unix seconds
}

export function getSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.token || s.expires_at * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the session lasts until the page is closed */
  }
  memory = s;
  notify();
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  memory = null;
  notify();
}

// Fallback when localStorage is blocked, and a tiny subscription so the header updates after sign-in/out.
let memory: Session | null = null;
const listeners = new Set<() => void>();

export function currentSession(): Session | null {
  if (typeof window === "undefined") return null;
  return getSession() ?? (memory && memory.expires_at * 1000 > Date.now() ? memory : null);
}

export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Send the user to the sign-in page, then back to where they were. */
export function redirectToLogin(): void {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/login")) return;
  const next = window.location.pathname + window.location.search;
  // full page load on purpose: drops every in-memory state of the signed-out session
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}
