// Imagens e arquivos são guardados no IndexedDB (e sincronizados para o Drive).
// O conteúdo das páginas guarda apenas a referência "asset://<id>".

import { useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
import { db } from "../db/schema";
import { saveAsset } from "../db/repo";
import { fetchAssetBlob } from "../sync/syncEngine";

export const ASSET_PREFIX = "asset://";

const urlCache = new Map<string, string>();

async function maybeCompress(file: File): Promise<Blob> {
  const compressible = /^image\/(jpeg|png|webp|bmp)$/.test(file.type);
  if (!compressible || file.size < 300 * 1024) return file;
  try {
    const out = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.85 });
    return out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

export async function storeFile(file: File, profileId: string, pageId: string | null): Promise<string> {
  const blob = await maybeCompress(file);
  const asset = await saveAsset(blob, file.name || "arquivo", profileId, pageId);
  return `${ASSET_PREFIX}${asset.id}`;
}

export function assetIdOf(url: string): string | null {
  return url.startsWith(ASSET_PREFIX) ? url.slice(ASSET_PREFIX.length) : null;
}

/** Converte "asset://id" em uma URL utilizável pelo navegador (blob:). */
export async function resolveAssetUrl(url: string): Promise<string> {
  const id = assetIdOf(url);
  if (!id) return url;
  const cached = urlCache.get(id);
  if (cached) return cached;
  const asset = await db.assets.get(id);
  let blob = asset?.blob ?? null;
  if (!blob && asset && !asset.deleted) blob = await fetchAssetBlob(id);
  if (!blob) return "";
  const typed = asset?.mime && blob.type !== asset.mime ? new Blob([blob], { type: asset.mime }) : blob;
  const objectUrl = URL.createObjectURL(typed);
  urlCache.set(id, objectUrl);
  return objectUrl;
}

export function useResolvedUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    const id = assetIdOf(url);
    return id ? (urlCache.get(id) ?? null) : url;
  });
  useEffect(() => {
    let alive = true;
    if (!url) {
      setResolved(null);
      return;
    }
    resolveAssetUrl(url).then((u) => alive && setResolved(u || null));
    return () => {
      alive = false;
    };
  }, [url]);
  return resolved;
}

export async function getAssetBlob(url: string): Promise<{ blob: Blob; name: string; mime: string } | null> {
  const id = assetIdOf(url);
  if (!id) return null;
  const asset = await db.assets.get(id);
  if (!asset) return null;
  const blob = asset.blob ?? (await fetchAssetBlob(id));
  return blob ? { blob, name: asset.name, mime: asset.mime } : null;
}
