import JSZip from "jszip";
import { db } from "../db/schema";
import type { Asset, Page, Profile } from "../db/types";
import { findAssetIds } from "../lib/blocks";
import { localChanges } from "../lib/events";
import { pickWinner } from "../sync/merge";
import { downloadBlob } from "../components/ui";
import { pageToMarkdown, type MdContext } from "./markdown";
import { getDescendants } from "../db/repo";
import { fetchAssetBlob } from "../sync/syncEngine";

function safeName(s: string) {
  return (s || "Sem título").replace(/[\\/:*?"<>|#%\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Sem título";
}

function mdFileName(p: Page) {
  return `${safeName(p.title)} (${p.id.slice(0, 6)}).md`;
}

async function buildZip(pages: Page[], profileId: string): Promise<Blob> {
  const all = await db.pages.where("profileId").equals(profileId).filter((p) => !p.deleted).toArray();
  const pagesMap = new Map(all.map((p) => [p.id, p]));
  const rowsByDb = new Map<string, Page[]>();
  for (const p of all) {
    if (p.kind !== "row" || !p.parentId || p.trashedAt !== null) continue;
    rowsByDb.set(p.parentId, [...(rowsByDb.get(p.parentId) ?? []), p]);
  }
  for (const list of rowsByDb.values()) list.sort((a, b) => a.order - b.order);

  const assetNames = new Map<string, string>();
  const ctx: MdContext = {
    pages: pagesMap,
    rowsByDb,
    assetPath: (id) => `arquivos/${assetNames.get(id) ?? id}`,
    pagePath: (id) => {
      const p = pagesMap.get(id);
      return p ? mdFileName(p) : `${id}.md`;
    },
  };

  const zip = new JSZip();
  const assetIds = new Set<string>();
  for (const p of pages) {
    findAssetIds(p.content).forEach((a) => assetIds.add(a));
    findAssetIds(p.cover).forEach((a) => assetIds.add(a));
  }
  for (const id of assetIds) {
    const a = await db.assets.get(id);
    if (!a || a.deleted) continue;
    const name = `${id.slice(0, 6)}-${safeName(a.name)}`;
    assetNames.set(id, name);
    const blob = a.blob ?? (await fetchAssetBlob(id));
    if (blob) zip.file(`arquivos/${name}`, blob);
  }
  for (const p of pages) zip.file(mdFileName(p), pageToMarkdown(p, ctx));
  return zip.generateAsync({ type: "blob" });
}

/** Exporta uma página (e suas subpáginas) como ZIP de Markdown + arquivos. */
export async function exportPage(pageId: string) {
  const page = await db.pages.get(pageId);
  if (!page) return;
  const desc = (await getDescendants(pageId)).filter((d) => d.trashedAt === null);
  const blob = await buildZip([page, ...desc], page.profileId);
  downloadBlob(blob, `${safeName(page.title)}.zip`);
}

export async function exportProfile(profileId: string) {
  const profile = await db.profiles.get(profileId);
  const pages = await db.pages
    .where("profileId")
    .equals(profileId)
    .filter((p) => !p.deleted && p.trashedAt === null)
    .toArray();
  const blob = await buildZip(pages, profileId);
  downloadBlob(blob, `Atrium - ${safeName(profile?.name ?? "perfil")}.zip`);
}

// ---------- Backup completo (JSON) ----------

interface BackupFile {
  app: "atrium";
  version: 1;
  exportedAt: number;
  profiles: Profile[];
  pages: Page[];
  assets: (Omit<Asset, "blob"> & { data?: string })[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup() {
  const profiles = await db.profiles.toArray();
  const pages = await db.pages.toArray();
  const assets: BackupFile["assets"] = [];
  for (const a of await db.assets.toArray()) {
    const { blob, ...meta } = a;
    const b = blob ?? (a.deleted ? null : await fetchAssetBlob(a.id));
    assets.push({ ...meta, data: b ? await blobToBase64(b) : undefined });
  }
  const backup: BackupFile = { app: "atrium", version: 1, exportedAt: Date.now(), profiles, pages, assets };
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([JSON.stringify(backup)], { type: "application/json" }), `atrium-backup-${date}.json`);
}

/** Importa um backup, mantendo a versão mais recente de cada item. Retorna quantos itens mudaram. */
export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== "atrium") throw new Error("Este arquivo não é um backup do Atrium.");
  let changed = 0;
  const now = Date.now();
  for (const p of data.profiles ?? []) {
    const local = await db.profiles.get(p.id);
    if (!local || pickWinner(local, p) === "remote") {
      await db.profiles.put(p);
      await db.dirty.put({ key: `profile:${p.id}`, at: now });
      changed++;
    }
  }
  for (const p of data.pages ?? []) {
    const local = await db.pages.get(p.id);
    if (!local || pickWinner(local, p) === "remote") {
      await db.pages.put(p);
      await db.dirty.put({ key: `page:${p.id}`, at: now });
      changed++;
    }
  }
  for (const a of data.assets ?? []) {
    const local = await db.assets.get(a.id);
    if (local && pickWinner(local, a) !== "remote" && local.blob) continue;
    const { data: b64, ...meta } = a;
    await db.assets.put({ ...meta, blob: b64 ? base64ToBlob(b64, a.mime) : local?.blob });
    await db.dirty.put({ key: `asset:${a.id}`, at: now });
    changed++;
  }
  localChanges.emit();
  return changed;
}
