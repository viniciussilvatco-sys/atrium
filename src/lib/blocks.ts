// Utilidades para lidar com o JSON de blocos do BlockNote sem depender do editor.

export interface AnyBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: AnyBlock[];
}

interface InlineNode {
  type: string;
  text?: string;
  content?: unknown;
  props?: Record<string, unknown>;
  href?: string;
}

export function inlineToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as InlineNode[])
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (n.type === "link") return inlineToText(n.content);
      if (n.type === "pageLink") return String(n.props?.title ?? "");
      return "";
    })
    .join("");
}

function blockText(b: AnyBlock): string {
  if (b.type === "table") {
    const t = b.content as { rows?: { cells: unknown[] }[] } | undefined;
    return (t?.rows ?? [])
      .map((r) =>
        r.cells
          .map((c) => {
            const cell = c as { content?: unknown } | unknown[];
            return Array.isArray(cell) ? inlineToText(cell) : inlineToText(cell?.content);
          })
          .join(" "),
      )
      .join("\n");
  }
  if (b.type === "math") return String(b.props?.latex ?? "");
  if (b.type === "embed") return String(b.props?.url ?? "");
  const parts = [inlineToText(b.content)];
  for (const key of ["caption", "name"]) {
    const v = b.props?.[key];
    if (typeof v === "string" && v) parts.push(v);
  }
  return parts.filter(Boolean).join(" ");
}

/** Extrai o texto puro de todos os blocos (usado na busca global). */
export function blocksToText(blocks: unknown[] | undefined): string {
  if (!blocks) return "";
  const out: string[] = [];
  const walk = (list: AnyBlock[]) => {
    for (const b of list) {
      const t = blockText(b);
      if (t) out.push(t);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks as AnyBlock[]);
  return out.join("\n");
}

/** Lista os ids de assets (`asset://<id>`) referenciados em qualquer lugar do conteúdo. */
export function findAssetIds(value: unknown): string[] {
  const json = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const ids = new Set<string>();
  for (const m of json.matchAll(/asset:\/\/([a-f0-9]+)/g)) ids.add(m[1]);
  return [...ids];
}

/** Gera ids novos para todos os blocos (usado ao duplicar páginas e aplicar templates). */
export function cloneBlocks(blocks: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(blocks ?? []), (key, v) => (key === "id" && typeof v === "string" ? undefined : v));
}
