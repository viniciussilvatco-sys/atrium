import JSZip from "jszip";
import { db, setMeta } from "../db/schema";
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

// ---------- Backup completo ----------
//
// Formato atual (.zip): "atrium-backup.json" (perfis e dados dos arquivos), "paginas/<id>.json" (uma por página)
// e "arquivos/<id>" (imagens, PDFs… guardados como arquivos normais). Nada vira um texto gigante, então não há
// limite de tamanho ("Invalid string length" acontecia no formato antigo).
// O formato antigo (.json único, arquivos em base64) continua sendo aceito na restauração.

type AssetMeta = Omit<Asset, "blob">;

interface BackupManifest {
  app: "atrium";
  version: 2;
  exportedAt: number;
  profiles: Profile[];
  assets: AssetMeta[];
  pageCount: number;
}

interface LegacyBackupFile {
  app: "atrium";
  version: 1;
  exportedAt: number;
  profiles: Profile[];
  pages: Page[];
  assets: (AssetMeta & { data?: string })[];
}

const MANIFEST = "atrium-backup.json";

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup() {
  const zip = new JSZip();
  let pageCount = 0;
  await db.pages.each((p) => {
    zip.file(`paginas/${p.id}.json`, JSON.stringify(p));
    pageCount++;
  });
  const assets: AssetMeta[] = [];
  for (const a of await db.assets.toArray()) {
    const { blob, ...meta } = a;
    assets.push(meta);
    const b = blob ?? (a.deleted ? null : await fetchAssetBlob(a.id));
    // Imagens e PDFs já são comprimidos: guardar sem recomprimir é bem mais rápido.
    if (b) zip.file(`arquivos/${a.id}`, b, { compression: "STORE" });
  }
  const manifest: BackupManifest = { app: "atrium", version: 2, exportedAt: Date.now(), profiles: await db.profiles.toArray(), assets, pageCount };
  zip.file(MANIFEST, JSON.stringify(manifest));
  const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(out, `atrium-backup-${date}.zip`);
  // Guarda a data para o lembrete de backup (Configurações e barra lateral).
  await setMeta("lastBackup", Date.now());
  await setMeta("backupSnooze", null);
}

// Cada item do backup só entra se for mais novo que o que já está no aparelho.

async function restoreProfile(p: Profile, now: number): Promise<boolean> {
  const local = await db.profiles.get(p.id);
  if (local && pickWinner(local, p) !== "remote") return false;
  await db.profiles.put(p);
  await db.dirty.put({ key: `profile:${p.id}`, at: now });
  return true;
}

async function restorePageItem(p: Page, now: number): Promise<boolean> {
  const local = await db.pages.get(p.id);
  if (local && pickWinner(local, p) !== "remote") return false;
  await db.pages.put(p);
  await db.dirty.put({ key: `page:${p.id}`, at: now });
  return true;
}

async function restoreAsset(meta: AssetMeta, getBlob: () => Promise<Blob | undefined>, now: number): Promise<boolean> {
  const local = await db.assets.get(meta.id);
  if (local && pickWinner(local, meta) !== "remote" && local.blob) return false;
  const blob = (await getBlob()) ?? local?.blob;
  await db.assets.put({ ...meta, blob });
  await db.dirty.put({ key: `asset:${meta.id}`, at: now });
  return true;
}

async function importZipBackup(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST);
  if (!manifestFile) throw new Error("Este arquivo não é um backup do Atrium.");
  const manifest = JSON.parse(await manifestFile.async("string")) as BackupManifest;
  if (manifest.app !== "atrium") throw new Error("Este arquivo não é um backup do Atrium.");
  const now = Date.now();
  let changed = 0;
  for (const p of manifest.profiles ?? []) if (await restoreProfile(p, now)) changed++;
  for (const f of zip.file(/^paginas\/[^/]+\.json$/)) {
    if (await restorePageItem(JSON.parse(await f.async("string")) as Page, now)) changed++;
  }
  for (const a of manifest.assets ?? []) {
    const getBlob = async () => {
      const f = zip.file(`arquivos/${a.id}`);
      return f ? new Blob([await f.async("blob")], { type: a.mime }) : undefined;
    };
    if (await restoreAsset(a, getBlob, now)) changed++;
  }
  return changed;
}

async function importLegacyJsonBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as LegacyBackupFile;
  if (data.app !== "atrium") throw new Error("Este arquivo não é um backup do Atrium.");
  const now = Date.now();
  let changed = 0;
  for (const p of data.profiles ?? []) if (await restoreProfile(p, now)) changed++;
  for (const p of data.pages ?? []) if (await restorePageItem(p, now)) changed++;
  for (const a of data.assets ?? []) {
    const { data: b64, ...meta } = a;
    if (await restoreAsset(meta, async () => (b64 ? base64ToBlob(b64, a.mime) : undefined), now)) changed++;
  }
  return changed;
}

/** Restaura um backup (.zip atual ou .json antigo), mantendo a versão mais recente de cada item. Retorna quantos itens mudaram. */
export async function importBackup(file: File): Promise<number> {
  const isZip = (await file.slice(0, 2).text()) === "PK";
  const changed = isZip ? await importZipBackup(file) : await importLegacyJsonBackup(file);
  localChanges.emit();
  return changed;
}
