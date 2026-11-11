// Utilidades da sincronização para baixar vários arquivos ao mesmo tempo (testadas em pool.test.ts).

import type { DriveFile } from "./driveApi";

/** Quantos downloads do Drive acontecem ao mesmo tempo. */
export const PULL_CONCURRENCY = 6;

/**
 * Roda `fn` para cada item, com no máximo `limit` ao mesmo tempo.
 * Se algum falhar, não começa novos itens, espera os que já estão em andamento e lança o primeiro erro.
 */
export async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | null = null;
  const worker = async () => {
    while (!failure && next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  if (failure) throw (failure as { error: unknown }).error;
}

const kindOrder = (name: string) => (name.startsWith("profile-") ? 0 : name.startsWith("page-") ? 1 : 2);

/** Perfis primeiro, depois páginas (aparecem logo), por último imagens e anexos (mais pesados). */
export function sortForPull(files: DriveFile[]): DriveFile[] {
  return [...files].sort((a, b) => kindOrder(a.name) - kindOrder(b.name) || a.modifiedTime.localeCompare(b.modifiedTime));
}
