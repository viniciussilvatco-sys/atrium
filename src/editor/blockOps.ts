// Funções puras usadas pelo menu dos 6 pontinhos (duplicar e mover blocos).

/** Cópia do bloco (e dos filhos) sem os ids, para o editor criar ids novos. */
export function cloneWithoutIds<T extends { id?: string; children?: T[] }>(block: T): Omit<T, "id"> {
  const { id: _id, children, ...rest } = JSON.parse(JSON.stringify(block)) as T;
  return { ...rest, children: (children ?? []).map((c) => cloneWithoutIds(c)) } as Omit<T, "id">;
}

/** Ids das subpáginas e bancos de dados citados por blocos "Página"/"Banco de dados" (inclusive em filhos). */
export function linkedPageIds(blocks: { type: string; props?: Record<string, unknown>; children?: unknown[] }[]): string[] {
  const out: string[] = [];
  const walk = (list: typeof blocks) => {
    for (const b of list) {
      if (b.type === "subpage" && typeof b.props?.pageId === "string") out.push(b.props.pageId);
      if (b.type === "database" && typeof b.props?.databaseId === "string") out.push(b.props.databaseId);
      if (Array.isArray(b.children)) walk(b.children as typeof blocks);
    }
  };
  walk(blocks);
  return out;
}

type RawBlock = { type?: string; content?: unknown; children?: unknown[] };
const isBlankParagraph = (b: RawBlock) =>
  b.type === "paragraph" && (!Array.isArray(b.content) || !b.content.length) && !b.children?.length;

/** Acrescenta blocos ao fim de uma página, sem deixar linhas vazias sobrando entre o conteúdo e os blocos novos. */
export function appendBlocks(content: unknown[], blocks: unknown[]): unknown[] {
  const kept = [...content] as RawBlock[];
  while (kept.length && isBlankParagraph(kept[kept.length - 1])) kept.pop();
  return [...kept, ...blocks];
}

