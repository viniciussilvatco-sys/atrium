// Login no Google pelo navegador (Google Identity Services), sem servidor próprio.
// Usamos só o escopo drive.appdata: o Atrium enxerga apenas a própria pasta oculta
// dentro do seu Drive, nunca seus outros arquivos.

import { Emitter } from "../lib/events";

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const TOKEN_KEY = "atrium.gtoken";
const CONNECTED_KEY = "atrium.gconnected";
const CLIENT_KEY = "atrium.clientId";
const EMAIL_KEY = "atrium.gemail";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): TokenClient;
          revoke(token: string, done?: () => void): void;
        };
      };
    };
  }
}

export type AuthState = "disconnected" | "connected" | "needsReauth" | "noClientId";
export const authChanges = new Emitter<AuthState>();

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* armazenamento indisponível */
  }
}

export function getClientId(): string {
  return (safeGet(CLIENT_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
}

export function setClientId(id: string) {
  safeSet(CLIENT_KEY, id.trim() || null);
  client = null;
  authChanges.emit(getAuthState());
}

export function isConnected(): boolean {
  return safeGet(CONNECTED_KEY) === "1";
}

export function getConnectedEmail(): string | null {
  return safeGet(EMAIL_KEY);
}

let reauthNeeded = false;

export function getAuthState(): AuthState {
  if (!getClientId()) return "noClientId";
  if (!isConnected()) return "disconnected";
  return reauthNeeded ? "needsReauth" : "connected";
}

function readToken(): { token: string; expiresAt: number } | null {
  const raw = safeGet(TOKEN_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    return t.expiresAt > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

async function waitForGis(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!window.google?.accounts?.oauth2) {
    if (Date.now() - start > timeoutMs) throw new Error("Não foi possível carregar o login do Google. Verifique sua conexão.");
    await new Promise((r) => setTimeout(r, 150));
  }
}

let client: TokenClient | null = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

function getClient(): TokenClient {
  if (client) return client;
  client = window.google!.accounts.oauth2.initTokenClient({
    client_id: getClientId(),
    scope: SCOPE,
    callback: (r) => {
      const p = pending;
      pending = null;
      if (r.error || !r.access_token) {
        p?.reject(new Error(r.error || "Login cancelado"));
        return;
      }
      safeSet(TOKEN_KEY, JSON.stringify({ token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }));
      p?.resolve(r.access_token);
    },
    error_callback: (e) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(e.type === "popup_failed_to_open" ? "popup_blocked" : e.type));
    },
  });
  return client;
}

async function requestToken(prompt: string): Promise<string> {
  await waitForGis();
  if (pending) pending.reject(new Error("superseded"));
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending?.resolve === done) pending = null;
      reject(new Error("timeout"));
    }, 120_000);
    const done = (t: string) => {
      clearTimeout(timer);
      resolve(t);
    };
    pending = {
      resolve: done,
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    };
    getClient().requestAccessToken({ prompt, login_hint: getConnectedEmail() ?? undefined });
  });
}

async function fetchEmail(token: string) {
  try {
    const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const j = await r.json();
      if (j.user?.emailAddress) safeSet(EMAIL_KEY, j.user.emailAddress);
    }
  } catch {
    /* opcional */
  }
}

/** Deve ser chamado a partir de um clique do usuário (abre a janela do Google). */
export async function connect(): Promise<void> {
  if (!getClientId()) throw new Error("Configure o ID do cliente Google em Configurações primeiro.");
  const token = await requestToken(isConnected() ? "" : "consent");
  safeSet(CONNECTED_KEY, "1");
  reauthNeeded = false;
  await fetchEmail(token);
  authChanges.emit(getAuthState());
}

export function disconnect() {
  const t = readToken();
  if (t && window.google) window.google.accounts.oauth2.revoke(t.token);
  safeSet(TOKEN_KEY, null);
  safeSet(CONNECTED_KEY, null);
  safeSet(EMAIL_KEY, null);
  reauthNeeded = false;
  authChanges.emit(getAuthState());
}

export function invalidateToken() {
  safeSet(TOKEN_KEY, null);
}

let gestureListenerArmed = false;

/**
 * Quando o token expira e o navegador bloqueia a janela de renovação (sem clique),
 * esperamos o próximo clique em qualquer lugar do app para renovar silenciosamente.
 */
function armReauthOnNextGesture() {
  if (gestureListenerArmed) return;
  gestureListenerArmed = true;
  const handler = () => {
    gestureListenerArmed = false;
    window.removeEventListener("pointerdown", handler, true);
    requestToken("")
      .then(() => {
        reauthNeeded = false;
        authChanges.emit(getAuthState());
      })
      .catch(() => {
        /* o usuário pode reconectar em Configurações */
      });
  };
  window.addEventListener("pointerdown", handler, true);
}

/** Retorna um token válido, renovando quando possível. Null se não conectado. */
export async function getToken(): Promise<string | null> {
  if (!isConnected() || !getClientId()) return null;
  const cached = readToken();
  if (cached) return cached.token;
  try {
    const t = await requestToken("");
    if (reauthNeeded) {
      reauthNeeded = false;
      authChanges.emit(getAuthState());
    }
    return t;
  } catch {
    reauthNeeded = true;
    authChanges.emit(getAuthState());
    armReauthOnNextGesture();
    return null;
  }
}
