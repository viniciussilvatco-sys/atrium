// Motor de sincronização: baixa o que mudou no Drive, mescla com o banco local
// e envia as alterações locais pendentes. Cada página, perfil e arquivo vira um
// arquivo separado na pasta oculta do app no Drive.

import { db, getMeta, setMeta } from "../db/schema";
import type { Asset, Page, Profile, SyncRecordType } from "../db/types";
import { Emitter, localChanges } from "../lib/events";
import { mergePage, mergeSimple } from "./merge";
import { NotAuthorizedError, deleteFile, downloadBlob, downloadJson, listFiles, uploadFile, type DriveFile } from "./driveApi";
import { authChanges, getAuthState, isConnected } from "./googleAuth";

export type SyncState = "disconnected" | "idle" | "syncing" | "pending" | "offline" | "error" | "needsReauth";

export interface SyncStatus {
  state: SyncState;
  lastSync: number | null;
  pending: number;
  error?: string;
  progress?: string;
}

export const syncStatus = new Emitter<SyncStatus>();
let current: SyncStatus = { state: "disconnected", lastSync: null, pending: 0 };

export function getSyncStatus(): SyncStatus {
  return current;
}

function setStatus(patch: Partial<SyncStatus>) {
  current = { ...current, ...patch };
  syncStatus.emit(current);
}

/** Emitido quando registros chegam do Drive (a página aberta pode precisar recarregar). */
export const remoteChanges = new Emitter<{ pages: string[] }>();

function fileName(type: SyncRecordType, id: string) {
  return type === "asset" ? `asset-${id}` : `${type}-${id}.json`;
}

function parseName(name: string): { type: SyncRecordType; id: string } | null {
  const m = /^(page|profile)-([a-zA-Z0-9]+)\.json$/.exec(name) ?? /^(asset)-([a-zA-Z0-9]+)$/.exec(name);
  return m ? { type: m[1] as SyncRecordType, id: m[2] } : null;
}

async function isDirty(key: string) {
  return !!(await db.dirty.get(key));
}

// ---------- Pull ----------

async function applyRemoteFile(f: DriveFile, changedPages: string[]) {
  const parsed = parseName(f.name);
  if (!parsed) return;
  const key = `${parsed.type}:${parsed.id}`;
  const known = await db.remote.get(key);
  await db.remote.put({ key, fileId: f.id, modifiedTime: f.modifiedTime });
  // Fomos nós que gravamos esta versão: nada a fazer.
  if (known && known.fileId === f.id && known.modifiedTime === f.modifiedTime) return;

  const dirty = await isDirty(key);

  if (parsed.type === "page") {
    const remote = await downloadJson<Page>(f.id);
    if (!remote) return;
    const local = await db.pages.get(parsed.id);
    const res = mergePage(local, remote, dirty);
    if (res.write) {
      await db.pages.put(res.write);
      changedPages.push(parsed.id);
    }
    if (res.clearDirty) await db.dirty.delete(key);
    if (res.pushBack) await db.dirty.put({ key, at: Date.now() });
    return;
  }

  if (parsed.type === "profile") {
    const remote = await downloadJson<Profile>(f.id);
    if (!remote) return;
    const res = mergeSimple(await db.profiles.get(parsed.id), remote, dirty);
    if (res.write) await db.profiles.put(res.write);
    if (res.clearDirty) await db.dirty.delete(key);
    if (res.pushBack) await db.dirty.put({ key, at: Date.now() });
    return;
  }

  // asset: metadados vêm nas appProperties, o conteúdo é baixado em seguida.
  const ap = f.appProperties ?? {};
  const remoteMeta: Asset = {
    id: parsed.id,
    profileId: ap.profileId ?? "",
    pageId: ap.pageId || null,
    name: ap.name ?? "arquivo",
    mime: ap.mime ?? "application/octet-stream",
    size: Number(f.size ?? 0),
    deleted: ap.deleted === "1",
    updatedAt: Number(ap.updatedAt ?? 0),
    deviceId: ap.deviceId ?? "",
  };
  const local = await db.assets.get(parsed.id);
  const res = mergeSimple(local, remoteMeta, dirty);
  if (res.write) {
    const rec: Asset = { ...res.write, blob: local?.blob };
    if (rec.deleted) rec.blob = undefined;
    else if (!rec.blob) rec.blob = (await downloadBlob(f.id)) ?? undefined;
    await db.assets.put(rec);
  }
  if (res.clearDirty) await db.dirty.delete(key);
  if (res.pushBack) await db.dirty.put({ key, at: Date.now() });
}

async function pull() {
  const since = await getMeta<string | null>("lastPull", null);
  // Pequena sobreposição para não perder arquivos gravados no mesmo segundo.
  const sinceIso = since ? new Date(new Date(since).getTime() - 3000).toISOString() : undefined;
  const files = await listFiles(sinceIso);
  const changedPages: string[] = [];
  let maxTime = since;
  let n = 0;
  for (const f of files) {
    n++;
    if (files.length > 20) setStatus({ progress: `Baixando ${n}/${files.length}` });
    await applyRemoteFile(f, changedPages);
    if (!maxTime || f.modifiedTime > maxTime) maxTime = f.modifiedTime;
  }
  if (maxTime) await setMeta("lastPull", maxTime);
  if (changedPages.length) remoteChanges.emit({ pages: changedPages });
}

// ---------- Push ----------

async function pushOne(key: string, at: number) {
  const [type, id] = key.split(":") as [SyncRecordType, string];
  const remote = await db.remote.get(key);
  let file: DriveFile | null = null;

  if (type === "page" || type === "profile") {
    const rec = type === "page" ? await db.pages.get(id) : await db.profiles.get(id);
    if (!rec) {
      await db.dirty.delete(key);
      return;
    }
    const body = new Blob([JSON.stringify(rec)], { type: "application/json" });
    file = await uploadFile(fileName(type, id), body, { type, id, updatedAt: String(rec.updatedAt) }, remote?.fileId);
  } else {
    const a = await db.assets.get(id);
    if (!a) {
      await db.dirty.delete(key);
      return;
    }
    const props: Record<string, string> = {
      type: "asset",
      id,
      profileId: a.profileId,
      pageId: a.pageId ?? "",
      name: a.name.slice(0, 60),
      mime: a.mime.slice(0, 80),
      updatedAt: String(a.updatedAt),
      deviceId: a.deviceId,
      deleted: a.deleted ? "1" : "0",
    };
    if (a.deleted) {
      if (remote) file = await uploadFile(fileName(type, id), new Blob([]), props, remote.fileId);
    } else if (a.blob) {
      // Arquivos são imutáveis: só sobem uma vez.
      if (remote) {
        await db.dirty.delete(key);
        return;
      }
      file = await uploadFile(fileName(type, id), a.blob, props);
    }
  }

  if (file) await db.remote.put({ key, fileId: file.id, modifiedTime: file.modifiedTime });
  // Só limpa a pendência se ninguém editou de novo durante o envio.
  const still = await db.dirty.get(key);
  if (still && still.at === at) await db.dirty.delete(key);
}

async function push() {
  const entries = await db.dirty.toArray();
  // Arquivos primeiro, para que as páginas que os usam já os encontrem no Drive.
  entries.sort((a, b) => (a.key.startsWith("asset") ? -1 : 0) - (b.key.startsWith("asset") ? -1 : 0));
  let n = 0;
  for (const e of entries) {
    n++;
    if (entries.length > 5) setStatus({ progress: `Enviando ${n}/${entries.length}` });
    await pushOne(e.key, e.at);
  }
}

// ---------- Orquestração ----------

let running: Promise<void> | null = null;
let again = false;

async function refreshPending() {
  setStatus({ pending: await db.dirty.count() });
}

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce() {
  const auth = getAuthState();
  if (auth !== "connected" && auth !== "needsReauth") {
    setStatus({ state: "disconnected" });
    return;
  }
  if (!navigator.onLine) {
    setStatus({ state: "offline" });
    await refreshPending();
    return;
  }
  setStatus({ state: "syncing", error: undefined, progress: undefined });
  try {
    await pull();
    await push();
    await setMeta("lastSync", Date.now());
    await refreshPending();
    setStatus({ state: current.pending ? "pending" : "idle", lastSync: Date.now(), progress: undefined });
  } catch (e) {
    await refreshPending();
    if (e instanceof NotAuthorizedError) {
      setStatus({ state: "needsReauth", progress: undefined });
    } else {
      setStatus({ state: navigator.onLine ? "error" : "offline", error: (e as Error).message, progress: undefined });
    }
  }
}

/** Apaga do Drive todos os dados do Atrium (usado em "Apagar dados na nuvem"). */
export async function wipeRemote() {
  const files = await listFiles();
  for (const f of files) await deleteFile(f.id);
  await db.remote.clear();
  await setMeta("lastPull", null);
}

/** Esquece o estado de sync (ex.: ao desconectar), mantendo os dados locais. */
export async function resetSyncState() {
  await db.remote.clear();
  await setMeta("lastPull", null);
  // Tudo o que existe localmente precisa ir para a próxima conta conectada.
  const now = Date.now();
  const keys = [
    ...(await db.pages.toCollection().primaryKeys()).map((k) => `page:${k}`),
    ...(await db.profiles.toCollection().primaryKeys()).map((k) => `profile:${k}`),
    ...(await db.assets.toCollection().primaryKeys()).map((k) => `asset:${k}`),
  ];
  await db.dirty.bulkPut(keys.map((key) => ({ key, at: now })));
}

let started = false;

export function startSyncEngine() {
  if (started) return;
  started = true;
  getMeta<number | null>("lastSync", null).then((lastSync) => setStatus({ lastSync }));
  refreshPending();

  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  localChanges.on(() => {
    refreshPending();
    if (!isConnected()) return;
    if (current.state === "idle") setStatus({ state: "pending" });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => syncNow(), 4000);
  });

  let lastFocusSync = 0;
  const onFocus = () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastFocusSync < 15_000) return;
    lastFocusSync = Date.now();
    syncNow();
  };
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", () => syncNow());
  window.addEventListener("offline", () => setStatus({ state: "offline" }));

  // A cada minuto envia pendências; a cada 5 minutos também busca novidades.
  let tick = 0;
  setInterval(() => {
    tick++;
    if (!isConnected()) return;
    if (current.pending > 0 || tick % 5 === 0) syncNow();
  }, 60_000);

  authChanges.on((s) => {
    if (s === "connected") syncNow();
    else if (s === "disconnected" || s === "noClientId") setStatus({ state: "disconnected" });
    else if (s === "needsReauth") setStatus({ state: "needsReauth" });
  });

  if (isConnected()) syncNow();
  else setStatus({ state: "disconnected" });
}

/** Baixa sob demanda um arquivo cujo conteúdo ainda não está no aparelho. */
export async function fetchAssetBlob(id: string): Promise<Blob | null> {
  const remote = await db.remote.get(`asset:${id}`);
  if (!remote) return null;
  try {
    const blob = await downloadBlob(remote.fileId);
    if (blob) {
      const a = await db.assets.get(id);
      if (a) await db.assets.put({ ...a, blob });
    }
    return blob;
  } catch {
    return null;
  }
}
