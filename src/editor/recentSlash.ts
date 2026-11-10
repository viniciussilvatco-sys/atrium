// Itens usados recentemente no menu "/" (funções puras, testadas em recentSlash.test.ts).

export const RECENT_GROUP = "Usados recentemente";
export const RECENT_MAX = 5;

/** Marca invisível no título das cópias: o BlockNote usa o título como chave, que precisa ser única. */
const MARK = "​";

interface SlashItem {
  title: string;
  group?: string;
}

/** Identificador estável de um item: a `key` dos itens padrão do BlockNote ou, nos nossos, o título. */
export function slashItemId(item: SlashItem): string {
  const key = (item as { key?: unknown }).key;
  return typeof key === "string" ? key : item.title.split(MARK).join("");
}

/** Coloca `id` no início da lista, sem repetir, mantendo no máximo `max` itens. */
export function pushRecent(list: string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Devolve a lista com cópias dos itens recentes no topo, num grupo próprio. Ids que não existem mais são ignorados. */
export function withRecents<T extends SlashItem>(items: T[], recentIds: string[]): T[] {
  const byId = new Map(items.map((i) => [slashItemId(i), i]));
  const recents = recentIds
    .map((id) => byId.get(id))
    .filter((i): i is T => !!i)
    .map((i) => ({ ...i, title: i.title + MARK, group: RECENT_GROUP }));
  return [...recents, ...items];
}
