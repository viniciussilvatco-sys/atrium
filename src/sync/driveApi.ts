// Chamadas mínimas à API REST do Google Drive v3, sempre dentro da pasta oculta
// "appDataFolder" (exclusiva do Atrium, invisível na interface do Drive).

import { getToken, invalidateToken } from "./googleAuth";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
  size?: string;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Não conectado ao Google Drive");
  }
}

async function authed(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getToken();
  if (!token) throw new NotAuthorizedError();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && retry) {
    invalidateToken();
    return authed(input, init, false);
  }
  if ((res.status === 429 || res.status >= 500) && retry) {
    await new Promise((r) => setTimeout(r, 1500));
    return authed(input, init, false);
  }
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

/** Lista arquivos da pasta do app, opcionalmente só os modificados depois de `since` (ISO). */
export async function listFiles(since?: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  const q = since ? `modifiedTime > '${since}' and trashed = false` : "trashed = false";
  do {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      q,
      pageSize: "1000",
      fields: "nextPageToken, files(id, name, modifiedTime, appProperties, size)",
      orderBy: "modifiedTime",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await authed(`${API}/files?${params}`);
    const json = await res.json();
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

export async function downloadJson<T>(fileId: string): Promise<T | null> {
  const res = await authed(`${API}/files/${fileId}?alt=media`);
  if (res.status === 404) return null;
  return res.json();
}

export async function downloadBlob(fileId: string): Promise<Blob | null> {
  const res = await authed(`${API}/files/${fileId}?alt=media`);
  if (res.status === 404) return null;
  return res.blob();
}

function multipart(metadata: object, body: Blob): { body: Blob; contentType: string } {
  const boundary = `atrium${Math.random().toString(36).slice(2)}`;
  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${body.type || "application/octet-stream"}\r\n\r\n`,
    body,
    `\r\n--${boundary}--`,
  ];
  return { body: new Blob(parts), contentType: `multipart/related; boundary=${boundary}` };
}

/** Cria (fileId ausente) ou atualiza um arquivo. Retorna o arquivo resultante. */
export async function uploadFile(
  name: string,
  body: Blob,
  appProperties: Record<string, string>,
  fileId?: string,
): Promise<DriveFile> {
  const fields = "id, name, modifiedTime, appProperties";
  const metadata = fileId ? { appProperties } : { name, parents: ["appDataFolder"], appProperties };
  const mp = multipart(metadata, body);
  const url = fileId
    ? `${UPLOAD}/files/${fileId}?uploadType=multipart&fields=${encodeURIComponent(fields)}`
    : `${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent(fields)}`;
  const res = await authed(url, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": mp.contentType },
    body: mp.body,
  });
  if (res.status === 404 && fileId) {
    // O arquivo sumiu do Drive: recria.
    return uploadFile(name, body, appProperties);
  }
  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  await authed(`${API}/files/${fileId}`, { method: "DELETE" });
}

export async function getQuota(): Promise<{ usage: number; limit: number } | null> {
  try {
    const res = await authed(`${API}/about?fields=storageQuota`);
    const j = await res.json();
    return { usage: Number(j.storageQuota?.usage ?? 0), limit: Number(j.storageQuota?.limit ?? 0) };
  } catch {
    return null;
  }
}
