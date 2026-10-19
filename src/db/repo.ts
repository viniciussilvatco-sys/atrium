import { db } from "./schema";
import type { Asset, DbView, Page, PageKind, Profile, PropDef, SyncRecordType } from "./types";
import { newId, getDeviceId } from "../lib/ids";
import { blocksToText, cloneBlocks, findAssetIds } from "../lib/blocks";
import { localChanges } from "../lib/events";

export const TRASH_RETENTION_DAYS = 30;

async function markDirty(type: SyncRecordType, id: string) {
  await db.dirty.put({ key: `${type}:${id}`, at: Date.now() });
  localChanges.emit();
}

function stamp<T extends object>(obj: T): T & { updatedAt: number; deviceId: string } {
  return { ...obj, updatedAt: Date.now(), deviceId: getDeviceId() };
}

// ---------- Perfis ----------

export const PROFILE_COLORS = ["#d9a441", "#4f8cc9", "#5aa469", "#c05f8a", "#8b6fd6", "#d0663f", "#5f9ea0", "#888888"];

export async function listProfiles(): Promise<Profile[]> {
  const all = await db.profiles.orderBy("order").toArray();
  return all.filter((p) => !p.deleted);
}

export async function createProfile(name: string, icon = "📁", color = PROFILE_COLORS[0]): Promise<Profile> {
  const existing = await listProfiles();
  const profile: Profile = stamp({
    id: newId(),
    name,
    icon,
    color,
    order: existing.length ? Math.max(...existing.map((p) => p.order)) + 1 : 0,
  });
  await db.profiles.put(profile);
  await markDirty("profile", profile.id);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  const p = await db.profiles.get(id);
  if (!p) return;
  await db.profiles.put(stamp({ ...p, ...patch }));
  await markDirty("profile", id);
}

export async function deleteProfile(id: string) {
  const p = await db.profiles.get(id);
  if (!p) return;
  await db.profiles.put(stamp({ ...p, deleted: true }));
  await markDirty("profile", id);
  const pages = await db.pages.where("profileId").equals(id).toArray();
  for (const page of pages) await tombstonePage(page);
}

// ---------- Páginas ----------

export interface NewPageInput {
  profileId: string;
  parentId?: string | null;
  kind?: PageKind;
  title?: string;
  icon?: string;
  cover?: string | null;
  content?: unknown[];
  properties?: Record<string, unknown>;
  dbSchema?: PropDef[];
  views?: DbView[];
  isTemplate?: boolean;
  order?: number;
}

async function nextOrder(profileId: string, parentId: string | null): Promise<number> {
  const siblings = await db.pages
    .where("profileId")
    .equals(profileId)
    .filter((p) => p.parentId === parentId && !p.deleted)
    .toArray();
  return siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
}

export async function createPage(input: NewPageInput): Promise<Page> {
  const parentId = input.parentId ?? null;
  const now = Date.now();
  const content = input.content ?? [];
  const page: Page = stamp({
    id: newId(),
    profileId: input.profileId,
    parentId,
    kind: input.kind ?? "page",
    title: input.title ?? "",
    icon: input.icon ?? "",
    cover: input.cover ?? null,
    content,
    text: blocksToText(content),
    properties: input.properties ?? {},
    dbSchema: input.dbSchema,
    views: input.views,
    favorite: false,
    isTemplate: input.isTemplate,
    order: input.order ?? (await nextOrder(input.profileId, parentId)),
    trashedAt: null,
    createdAt: now,
  });
  await db.pages.put(page);
  await markDirty("page", page.id);
  return page;
}

export async function updatePage(id: string, patch: Partial<Page>) {
  await db.transaction("rw", db.pages, db.dirty, async () => {
    const p = await db.pages.get(id);
    if (!p) return;
    const next = { ...p, ...patch };
    if (patch.content) next.text = blocksToText(patch.content);
    await db.pages.put(stamp(next));
    await db.dirty.put({ key: `page:${id}`, at: Date.now() });
  });
  localChanges.emit();
}

export async function getDescendants(id: string): Promise<Page[]> {
  const out: Page[] = [];
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    const kids = await db.pages.where("parentId").equals(current).toArray();
    for (const k of kids) {
      if (k.deleted) continue;
      out.push(k);
      queue.push(k.id);
    }
  }
  return out;
}

export async function trashPage(id: string) {
  const now = Date.now();
  const all = [id, ...(await getDescendants(id)).filter((d) => d.trashedAt === null).map((d) => d.id)];
  for (const pid of all) await updatePage(pid, { trashedAt: now });
}

export async function restorePage(id: string) {
  const page = await db.pages.get(id);
  if (!page || page.trashedAt === null) return;
  const stampTs = page.trashedAt;
  // Se o pai também está na lixeira (ou sumiu), a página volta para a raiz.
  let parentId = page.parentId;
  if (parentId) {
    const parent = await db.pages.get(parentId);
    if (!parent || parent.deleted || parent.trashedAt !== null) parentId = null;
  }
  await updatePage(id, { trashedAt: null, parentId });
  for (const d of await getDescendants(id)) {
    if (d.trashedAt === stampTs) await updatePage(d.id, { trashedAt: null });
  }
}

async function tombstonePage(page: Page) {
  const tomb: Page = stamp({
    ...page,
    deleted: true,
    title: "",
    content: [],
    text: "",
    properties: {},
    conflicts: undefined,
    cover: null,
  });
  await db.pages.put(tomb);
  await markDirty("page", page.id);
  await deleteOrphanAssets(page);
}

async function deleteOrphanAssets(page: Page) {
  const referenced = new Set([...findAssetIds(page.content), ...findAssetIds(page.cover)]);
  if (!referenced.size) return;
  const others = await db.pages.filter((p) => p.id !== page.id && !p.deleted).toArray();
  const stillUsed = new Set(others.flatMap((p) => [...findAssetIds(p.content), ...findAssetIds(p.cover)]));
  for (const assetId of referenced) {
    if (stillUsed.has(assetId)) continue;
    const a = await db.assets.get(assetId);
    if (!a || a.deleted) continue;
    await db.assets.put(stamp({ ...a, deleted: true, blob: undefined }));
    await markDirty("asset", assetId);
  }
}

export async function deletePageForever(id: string) {
  const page = await db.pages.get(id);
  if (!page) return;
  const all = [page, ...(await getDescendants(id))];
  for (const p of all) await tombstonePage(p);
}

export async function emptyTrash(profileId: string) {
  const trashed = await db.pages
    .where("profileId")
    .equals(profileId)
    .filter((p) => p.trashedAt !== null && !p.deleted)
    .toArray();
  for (const p of trashed) await tombstonePage(p);
}

export async function purgeOldTrash() {
  const limit = Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000;
  const old = await db.pages.filter((p) => !p.deleted && p.trashedAt !== null && p.trashedAt < limit).toArray();
  for (const p of old) await tombstonePage(p);
}

/** Move uma página (e sua subárvore) para outro pai/posição/perfil. */
export async function movePage(id: string, target: { parentId: string | null; order: number; profileId?: string }) {
  const page = await db.pages.get(id);
  if (!page) return;
  if (target.parentId) {
    // Impede mover uma página para dentro dela mesma.
    if (target.parentId === id) return;
    const desc = await getDescendants(id);
    if (desc.some((d) => d.id === target.parentId)) return;
  }
  const profileId = target.profileId ?? page.profileId;
  await updatePage(id, { parentId: target.parentId, order: target.order, profileId });
  if (profileId !== page.profileId) {
    for (const d of await getDescendants(id)) await updatePage(d.id, { profileId });
  }
}

export async function duplicatePage(id: string, overrides: Partial<NewPageInput> = {}): Promise<Page | undefined> {
  const src = await db.pages.get(id);
  if (!src) return;
  const copy = await createPage({
    profileId: overrides.profileId ?? src.profileId,
    parentId: overrides.parentId !== undefined ? overrides.parentId : src.parentId,
    kind: src.kind,
    title: overrides.title ?? (src.title ? `${src.title} (cópia)` : ""),
    icon: src.icon,
    cover: src.cover,
    content: cloneBlocks(src.content),
    properties: { ...src.properties },
    dbSchema: src.dbSchema ? JSON.parse(JSON.stringify(src.dbSchema)) : undefined,
    views: src.views ? JSON.parse(JSON.stringify(src.views)) : undefined,
    isTemplate: overrides.isTemplate ?? src.isTemplate,
    order: overrides.order ?? src.order + 0.5,
  });
  const kids = await db.pages.where("parentId").equals(id).filter((k) => !k.deleted && k.trashedAt === null).toArray();
  for (const k of kids) {
    await duplicatePage(k.id, { parentId: copy.id, profileId: copy.profileId, title: k.title, isTemplate: overrides.isTemplate, order: k.order });
  }
  return copy;
}

// ---------- Bancos de dados ----------

export const STATUS_OPTIONS = [
  { id: "todo", name: "A fazer", color: "gray" },
  { id: "doing", name: "Em andamento", color: "blue" },
  { id: "done", name: "Concluído", color: "green" },
];

export function defaultDatabaseSchema(): { dbSchema: PropDef[]; views: DbView[] } {
  const status: PropDef = { id: newId(), name: "Status", type: "status", options: STATUS_OPTIONS.map((o) => ({ ...o, id: newId() })) };
  const tags: PropDef = { id: newId(), name: "Tags", type: "multiselect", options: [] };
  const date: PropDef = { id: newId(), name: "Data", type: "date" };
  return {
    dbSchema: [status, tags, date],
    views: [
      { id: newId(), name: "Tabela", type: "table", filters: [], sorts: [] },
      { id: newId(), name: "Quadro", type: "board", filters: [], sorts: [], groupBy: status.id },
      { id: newId(), name: "Calendário", type: "calendar", filters: [], sorts: [], dateProp: date.id },
    ],
  };
}

export async function createDatabase(profileId: string, parentId: string | null, title = "Banco de dados", order?: number) {
  return createPage({ profileId, parentId, kind: "database", title, icon: "🗂️", order, ...defaultDatabaseSchema() });
}

export async function createRow(db_: Page, properties: Record<string, unknown> = {}, title = "") {
  return createPage({ profileId: db_.profileId, parentId: db_.id, kind: "row", title, properties });
}

// ---------- Arquivos (imagens, PDFs, anexos) ----------

export async function saveAsset(file: Blob, name: string, profileId: string, pageId: string | null): Promise<Asset> {
  const asset: Asset = stamp({
    id: newId(),
    profileId,
    pageId,
    name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
  });
  await db.assets.put(asset);
  await markDirty("asset", asset.id);
  return asset;
}

// ---------- Primeira execução ----------

export async function seedDefaults() {
  const study = await createProfile("Estudo", "📚", "#4f8cc9");
  const work = await createProfile("Trabalho", "💼", "#d9a441");
  await createPage({
    profileId: study.id,
    title: "Bem-vindo ao Atrium",
    icon: "👋",
    content: welcomeContent(),
  });
  await createPage({ profileId: work.id, title: "Anotações de trabalho", icon: "📝" });
  return study;
}

function p(text: string, styles: Record<string, boolean> = {}) {
  return { type: "paragraph", content: [{ type: "text", text, styles }] };
}

function welcomeContent(): unknown[] {
  return [
    p("Este é o seu caderno. Algumas dicas para começar:"),
    { type: "bulletListItem", content: [{ type: "text", text: "Digite / para inserir blocos: títulos, listas, imagens, código, fórmulas, tabelas, bancos de dados e muito mais.", styles: {} }] },
    { type: "bulletListItem", content: [{ type: "text", text: "Digite @ para criar um link para outra página.", styles: {} }] },
    { type: "bulletListItem", content: [{ type: "text", text: "Use o seletor no topo da barra lateral para alternar entre perfis (Estudo, Trabalho...).", styles: {} }] },
    { type: "bulletListItem", content: [{ type: "text", text: "Ctrl+K abre a busca em todas as páginas.", styles: {} }] },
    { type: "bulletListItem", content: [{ type: "text", text: "Em Configurações, conecte o Google Drive para sincronizar entre seus dispositivos.", styles: {} }] },
    { type: "checkListItem", props: { checked: true }, content: [{ type: "text", text: "Abrir o Atrium pela primeira vez", styles: {} }] },
    { type: "checkListItem", props: { checked: false }, content: [{ type: "text", text: "Criar minha primeira página", styles: {} }] },
  ];
}
