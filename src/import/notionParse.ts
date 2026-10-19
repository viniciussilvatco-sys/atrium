// Funções puras para entender a exportação "Markdown & CSV" do Notion.
// Estrutura típica do ZIP:
//   Private & Shared/Aula 1 0123…(32 hex).md
//   Private & Shared/Aula 1 0123…/Subpágina abcd….md
//   Private & Shared/Aula 1 0123…/imagem.png

const NOTION_ID = /\s+[0-9a-f]{32}$/i;

/** "Aula 1 0123abcd….md" → { title: "Aula 1", base: "Aula 1 0123abcd…" } */
export function parseNotionName(fileName: string): { title: string; base: string } {
  const base = fileName.replace(/\.(md|csv)$/i, "");
  return { title: base.replace(NOTION_ID, "").trim() || "Sem título", base };
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Resolve um link relativo (já decodificado) a partir da pasta do arquivo Markdown. */
export function resolvePath(fromDir: string, rel: string): string {
  const parts = (fromDir ? fromDir.split("/") : []).concat(rel.split("/"));
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Descobre o pai de cada página: o arquivo "X.md" é pai dos arquivos dentro da pasta "X/".
 * Pastas sem página correspondente (ex.: "Private & Shared") são transparentes.
 */
export function buildParents(pagePaths: string[]): Map<string, string | null> {
  const byBase = new Set(pagePaths.map((p) => p.replace(/\.(md|csv)$/i, "")));
  const parents = new Map<string, string | null>();
  for (const path of pagePaths) {
    let dir = dirname(path);
    let parent: string | null = null;
    while (dir) {
      if (byBase.has(dir)) {
        parent = pagePaths.find((p) => p.replace(/\.(md|csv)$/i, "") === dir) ?? null;
        break;
      }
      dir = dirname(dir);
    }
    parents.set(path, parent);
  }
  return parents;
}

export const MARK = "https://atrium.local";

export const LINK_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
export const NOTION_URL = /^https?:\/\/(?:www\.)?notion\.(?:so|site)\/.*?([0-9a-f]{32})(?:[?#].*)?$/i;

/** Links locais (arquivos do ZIP) usados num Markdown, para enviar os arquivos antes da conversão. */
export function localLinks(md: string): { href: string; isImage: boolean }[] {
  return [...md.matchAll(LINK_RE)]
    .filter((m) => !/^(https?:|mailto:|tel:|#)/i.test(m[3]))
    .map((m) => ({ href: m[3], isImage: m[1] === "!" }));
}

export interface LinkTarget {
  kind: "page" | "image" | "file";
  id: string; // id da página ou do asset
  name?: string;
}

export interface Preprocessed {
  title: string | null;
  markdown: string;
  callouts: { emoji: string; text: string }[];
  maths: string[];
}

/** Separa um emoji inicial do texto do callout ("💡 Dica" → ["💡", "Dica"]). */
function splitEmoji(text: string): [string, string] {
  const m = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u.exec(text);
  return m ? [m[1], text.slice(m[0].length)] : ["💡", text];
}

/**
 * Prepara o Markdown do Notion para o conversor do editor:
 * - tira o "# Título" inicial (vira o título da página);
 * - troca <aside> (callouts) e blocos $$…$$ por marcadores, convertidos depois;
 * - reescreve links locais (imagens, arquivos, outras páginas) com `resolve`.
 */
export function preprocessNotionMarkdown(
  md: string,
  resolve: (href: string, isImage: boolean) => LinkTarget | null,
): Preprocessed {
  let text = md.replace(/\r\n?/g, "\n");
  let title: string | null = null;
  const titleMatch = /^﻿?\s*# (.+)\n?/.exec(text);
  if (titleMatch) {
    title = titleMatch[1].trim();
    text = text.slice(titleMatch[0].length);
  }

  const callouts: Preprocessed["callouts"] = [];
  text = text.replace(/<aside>\s*([\s\S]*?)\s*<\/aside>/g, (_, inner: string) => {
    const [emoji, rest] = splitEmoji(inner.replace(/<[^>]+>/g, "").trim());
    callouts.push({ emoji, text: rest.replace(/\n+/g, " ").trim() });
    return `\n\nATRIUMCALLOUT${callouts.length - 1}\n\n`;
  });

  const maths: string[] = [];
  text = text.replace(/^\s*\$\$\s*\n?([\s\S]*?)\n?\s*\$\$\s*$/gm, (_, latex: string) => {
    maths.push(latex.trim());
    return `\n\nATRIUMMATH${maths.length - 1}\n\n`;
  });

  // Links e imagens: ![alt](href) / [texto](href). O href do Notion vem com espaços codificados (%20).
  text = text.replace(LINK_RE, (whole, bang: string, label: string, href: string) => {
    if (/^(mailto:|tel:|#)/i.test(href)) return whole;
    // Links absolutos para o próprio Notion (notion.so/…-<id>) também podem apontar para páginas importadas.
    if (/^https?:/i.test(href) && !NOTION_URL.test(href)) return whole;
    const target = resolve(href, bang === "!");
    if (!target) return /^https?:/i.test(href) ? whole : label; // arquivo que não veio no ZIP: mantém só o texto
    if (target.kind === "image") return `![${label}](${MARK}/asset/${target.id})`;
    if (target.kind === "file") return `[${label || target.name || "arquivo"}](${MARK}/file/${target.id})`;
    return `[${label}](${MARK}/page/${target.id})`;
  });

  return { title, markdown: text.trim(), callouts, maths };
}

/** Converte CSV (como o Notion exporta bancos de dados) numa tabela Markdown. */
export function csvToMarkdownTable(csv: string): string {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = csv.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const clean = rows.filter((r) => r.some((c) => c.trim()));
  if (!clean.length) return "";
  const width = Math.max(...clean.map((r) => r.length));
  const fmt = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => (r[i] ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
  return [fmt(clean[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...clean.slice(1).map(fmt)].join("\n");
}

// ---------- Pós-processamento dos blocos gerados pelo editor ----------

interface Inline {
  type: string;
  text?: string;
  href?: string;
  styles?: Record<string, unknown>;
  content?: Inline[];
  props?: Record<string, unknown>;
}

interface Block {
  type: string;
  props?: Record<string, unknown>;
  content?: Inline[] | unknown;
  children?: Block[];
}

export interface PostContext {
  /** Título da página (para menções). */
  pageTitle: (id: string) => string;
  /** Verdadeiro se a página alvo é filha direta da página sendo convertida. */
  isChild: (id: string) => boolean;
  assetName: (id: string) => string;
  assetIsPdf: (id: string) => boolean;
  callouts: Preprocessed["callouts"];
  maths: string[];
  /** Conteúdo inline (texto) de um callout, já convertido pelo editor. */
  calloutInline: (text: string) => Inline[];
}

const markerOf = (href: string | undefined, kind: string) => {
  const prefix = `${MARK}/${kind}/`;
  return href?.startsWith(prefix) ? href.slice(prefix.length) : null;
};

function plain(content: Inline[] | undefined): string {
  return (content ?? []).map((n) => (n.type === "text" ? (n.text ?? "") : plain(n.content))).join("");
}

function fixInline(content: Inline[], ctx: PostContext): Inline[] {
  const out: Inline[] = [];
  for (const n of content) {
    if (n.type === "link") {
      const pageId = markerOf(n.href, "page");
      if (pageId) {
        out.push({ type: "pageLink", props: { pageId, title: ctx.pageTitle(pageId) } });
        continue;
      }
      const fileId = markerOf(n.href, "file");
      if (fileId) {
        out.push(...(n.content ?? []));
        continue;
      }
    }
    out.push(n);
  }
  return out;
}

/** Transforma marcadores e links especiais nos blocos do Atrium (callout, fórmula, subpágina, arquivo, imagem). */
export function postprocessBlocks(blocks: Block[], ctx: PostContext): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const content = Array.isArray(b.content) ? (b.content as Inline[]) : undefined;
    const children = b.children?.length ? postprocessBlocks(b.children, ctx) : b.children;

    if (b.type === "paragraph" && content) {
      const only = content.length === 1 ? content[0] : null;
      const txt = plain(content).trim();
      const callout = /^ATRIUMCALLOUT(\d+)$/.exec(txt);
      if (callout) {
        const c = ctx.callouts[Number(callout[1])];
        out.push({ type: "callout", props: { emoji: c?.emoji ?? "💡" }, content: ctx.calloutInline(c?.text ?? "") });
        continue;
      }
      const math = /^ATRIUMMATH(\d+)$/.exec(txt);
      if (math) {
        out.push({ type: "math", props: { latex: ctx.maths[Number(math[1])] ?? "" } });
        continue;
      }
      if (only?.type === "link") {
        const pageId = markerOf(only.href, "page");
        if (pageId && ctx.isChild(pageId)) {
          out.push({ type: "subpage", props: { pageId } });
          continue;
        }
        const fileId = markerOf(only.href, "file");
        if (fileId) {
          out.push(
            ctx.assetIsPdf(fileId)
              ? { type: "pdf", props: { url: `asset://${fileId}`, name: ctx.assetName(fileId) } }
              : { type: "file", props: { url: `asset://${fileId}`, name: ctx.assetName(fileId) } },
          );
          continue;
        }
      }
    }

    if (b.type === "image") {
      const assetId = markerOf(String(b.props?.url ?? ""), "asset");
      if (assetId) {
        out.push({ ...b, props: { ...b.props, url: `asset://${assetId}`, name: b.props?.name || ctx.assetName(assetId) }, children });
        continue;
      }
    }

    out.push({ ...b, content: content ? fixInline(content, ctx) : b.content, children });
  }
  return out;
}
