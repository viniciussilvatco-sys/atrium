// Lógica pura de merge entre a versão local e a versão vinda do Drive.
// Regra: a versão com `updatedAt` maior vence (empate: maior deviceId).
// Exclusões definitivas (tombstones) sempre vencem, para nada "ressuscitar".
// Quando ambos os lados editaram a mesma página, a versão perdedora é guardada
// em `conflicts` para que nada seja perdido.

import type { ConflictCopy, Page } from "../db/types";

export const MAX_CONFLICTS = 10;

interface Syncable {
  updatedAt: number;
  deviceId: string;
  deleted?: boolean;
}

export type Winner = "local" | "remote" | "same";

export function pickWinner(local: Syncable, remote: Syncable): Winner {
  if (remote.deleted && !local.deleted) return "remote";
  if (local.deleted && !remote.deleted) return "local";
  if (local.updatedAt === remote.updatedAt && local.deviceId === remote.deviceId) return "same";
  if (remote.updatedAt !== local.updatedAt) return remote.updatedAt > local.updatedAt ? "remote" : "local";
  return remote.deviceId > local.deviceId ? "remote" : "local";
}

export interface MergeResult<T> {
  /** Registro que deve ser gravado localmente (undefined = nada a gravar). */
  write?: T;
  /** Se true, o registro local resultante precisa ser enviado ao Drive. */
  pushBack: boolean;
  /** Se true, a pendência local de envio pode ser descartada. */
  clearDirty: boolean;
}

/** Merge para perfis e assets (sem cópias de conflito). */
export function mergeSimple<T extends Syncable>(local: T | undefined, remote: T, localDirty: boolean): MergeResult<T> {
  if (!local) return { write: remote, pushBack: false, clearDirty: false };
  const w = pickWinner(local, remote);
  if (w === "same") return { pushBack: false, clearDirty: false };
  if (w === "remote") return { write: remote, pushBack: false, clearDirty: localDirty };
  return { pushBack: !localDirty, clearDirty: false };
}

function sameDoc(a: Page, b: Page): boolean {
  return a.title === b.title && JSON.stringify(a.content) === JSON.stringify(b.content);
}

function asConflict(p: Page): ConflictCopy {
  return { at: p.updatedAt, deviceId: p.deviceId, title: p.title, content: p.content };
}

function mergeConflictLists(...lists: (ConflictCopy[] | undefined)[]): ConflictCopy[] {
  const seen = new Map<string, ConflictCopy>();
  for (const list of lists) for (const c of list ?? []) seen.set(`${c.at}:${c.deviceId}`, c);
  return [...seen.values()].sort((a, b) => b.at - a.at).slice(0, MAX_CONFLICTS);
}

export function mergePage(local: Page | undefined, remote: Page, localDirty: boolean): MergeResult<Page> {
  if (!local) return { write: remote, pushBack: false, clearDirty: false };
  const w = pickWinner(local, remote);
  if (w === "same") return { pushBack: false, clearDirty: false };

  const bothEdited = localDirty && !local.deleted && !remote.deleted && !sameDoc(local, remote);

  if (w === "remote") {
    if (!bothEdited) return { write: remote, pushBack: false, clearDirty: localDirty };
    // Os dois lados mudaram: a remota vence, a local vira cópia de conflito.
    const merged: Page = {
      ...remote,
      conflicts: mergeConflictLists([asConflict(local)], remote.conflicts, local.conflicts),
      updatedAt: remote.updatedAt + 1,
    };
    return { write: merged, pushBack: true, clearDirty: false };
  }

  // A local vence.
  if (!bothEdited) return { pushBack: !localDirty, clearDirty: false };
  const merged: Page = {
    ...local,
    conflicts: mergeConflictLists([asConflict(remote)], local.conflicts, remote.conflicts),
  };
  return { write: merged, pushBack: true, clearDirty: false };
}
