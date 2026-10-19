import Dexie, { type EntityTable } from "dexie";
import type { Asset, DirtyEntry, MetaEntry, Page, Profile, RemoteEntry } from "./types";

export class AtriumDB extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  pages!: EntityTable<Page, "id">;
  assets!: EntityTable<Asset, "id">;
  dirty!: EntityTable<DirtyEntry, "key">;
  remote!: EntityTable<RemoteEntry, "key">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor() {
    super("atrium");
    this.version(1).stores({
      profiles: "id, order",
      pages: "id, profileId, parentId, kind, trashedAt, favorite, updatedAt",
      assets: "id, pageId, profileId",
      dirty: "key",
      remote: "key, fileId",
      meta: "key",
    });
  }
}

export const db = new AtriumDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
