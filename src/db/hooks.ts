import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./schema";
import type { Page } from "./types";

export function useProfiles() {
  return useLiveQuery(() => db.profiles.orderBy("order").filter((p) => !p.deleted).toArray(), [], undefined);
}

export function usePage(id: string | null | undefined) {
  return useLiveQuery(() => (id ? db.pages.get(id) : undefined), [id]);
}

const byOrder = (a: Page, b: Page) => a.order - b.order || a.createdAt - b.createdAt;

/** Páginas visíveis na árvore (sem linhas de banco de dados, templates, lixeira). */
export function useTreePages(profileId: string | null) {
  return useLiveQuery(
    async () => {
      if (!profileId) return [];
      const all = await db.pages
        .where("profileId")
        .equals(profileId)
        .filter((p) => !p.deleted)
        .toArray();
      const byId = new Map(all.map((p) => [p.id, p]));
      // Subpáginas de linhas de banco de dados ficam dentro da linha, não na árvore.
      const insideRow = new Map<string, boolean>();
      const hasRowAncestor = (p: Page, depth = 0): boolean => {
        if (!p.parentId || depth > 50) return false;
        const cached = insideRow.get(p.id);
        if (cached !== undefined) return cached;
        const parent = byId.get(p.parentId);
        const res = !!parent && (parent.kind === "row" || hasRowAncestor(parent, depth + 1));
        insideRow.set(p.id, res);
        return res;
      };
      return all
        .filter((p) => p.trashedAt === null && !p.isTemplate && p.kind !== "row" && !hasRowAncestor(p))
        .sort(byOrder);
    },
    [profileId],
    undefined,
  );
}

export function useRows(databaseId: string | null | undefined) {
  return useLiveQuery(
    async () => {
      if (!databaseId) return [];
      const rows = await db.pages
        .where("parentId")
        .equals(databaseId)
        .filter((p) => !p.deleted && p.trashedAt === null && p.kind === "row")
        .toArray();
      return rows.sort(byOrder);
    },
    [databaseId],
    undefined,
  );
}

export function useTrash(profileId: string | null) {
  return useLiveQuery(
    async () => {
      if (!profileId) return [];
      const all = await db.pages
        .where("profileId")
        .equals(profileId)
        .filter((p) => !p.deleted && p.trashedAt !== null)
        .toArray();
      // Mostra só as "raízes" de cada exclusão (subpáginas vão junto).
      const ids = new Set(all.map((p) => p.id));
      return all.filter((p) => !p.parentId || !ids.has(p.parentId)).sort((a, b) => b.trashedAt! - a.trashedAt!);
    },
    [profileId],
    undefined,
  );
}

export function useTemplates(profileId: string | null) {
  return useLiveQuery(
    async () => {
      if (!profileId) return [];
      return db.pages
        .where("profileId")
        .equals(profileId)
        .filter((p) => !p.deleted && p.trashedAt === null && !!p.isTemplate && !p.parentId)
        .toArray();
    },
    [profileId],
    undefined,
  );
}

export async function getAncestors(page: Page): Promise<Page[]> {
  const out: Page[] = [];
  let parentId = page.parentId;
  let guard = 0;
  while (parentId && guard++ < 50) {
    const parent = await db.pages.get(parentId);
    if (!parent) break;
    out.unshift(parent);
    parentId = parent.parentId;
  }
  return out;
}

export function useAncestors(page: Page | undefined) {
  return useLiveQuery(() => (page ? getAncestors(page) : Promise.resolve([] as Page[])), [page?.id, page?.parentId], []);
}
