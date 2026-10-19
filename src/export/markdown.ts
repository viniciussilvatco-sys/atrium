// Conversão do conteúdo do Atrium para Markdown (independente do editor, para exportar
// perfis inteiros sem precisar abrir cada página).

import type { Page } from "../db/types";
import type { AnyBlock } from "../lib/blocks";
import { formatValue } from "../database/query";

export interface MdContext {
  pages: Map<string, Page>;
  rowsByDb: Map<string, Page[]>;
  /** Caminho relativo do arquivo para um asset (ex.: "arquivos/abc-foto.png"). */
  assetPath: (assetId: string) => string;
  /** Caminho relativo para outra página exportada (ex.: "Outra página.md"). */
  pagePath: (pageId: string) => string;
}

interface Inline {
  type: string;
  text?: string;
  styles?: Record<string, unknown>;
  href?: string;
  content?: Inline[] | string;
  props?: Record<string, unknown>;
}

function escapeMd(s: string) {
  return s.replace(/([\\`*_[\]#<>|])/g, "\\$1");
}

function styled(text: string, styles: Record<string, unknown> = {}): string {
  if (!text) return "";
  if (styles.code) return "`" + text.replace(/`/g, "\\`") + "`";
  let out = escapeMd(text);
  // Mantém espaços nas bordas fora dos marcadores (o Markdown exige).
  const lead = out.match(/^\s*/)![0];
  const trail = out.match(/\s*$/)![0];
  out = out.trim();
  if (!out) return lead + trail;
  if (styles.bold) out = `**${out}**`;
  if (styles.italic) out = `*${out}*`;
  if (styles.strike) out = `~~${out}~~`;
  return lead + out + trail;
}

export function inlineToMd(content: unknown, ctx: MdContext): string {
  if (typeof content === "string") return escapeMd(content);
  if (!Array.isArray(content)) return "";
  return (content as Inline[])
    .map((n) => {
      if (n.type === "text") return styled(n.text ?? "", n.styles);
      if (n.type === "link") return `[${inlineToMd(n.content, ctx)}](${n.href})`;
      if (n.type === "pageLink") {
        const id = String(n.props?.pageId ?? "");
        const p = ctx.pages.get(id);
        const title = p?.title || String(n.props?.title ?? "") || "Página";
        return p ? `[${escapeMd(title)}](${encodeURI(ctx.pagePath(id))})` : escapeMd(title);
      }
      return "";
    })
    .join("");
}

function url(raw: unknown, ctx: MdContext): string {
  const s = String(raw ?? "");
  const m = /^asset:\/\/([a-f0-9]+)/.exec(s);
  return m ? encodeURI(ctx.assetPath(m[1])) : s;
}

function cellText(cell: unknown, ctx: MdContext): string {
  const content = Array.isArray(cell) ? cell : (cell as { content?: unknown })?.content;
  return inlineToMd(content, ctx).replace(/\n/g, " ").replace(/\|/g, "\\|");
}

export function databaseToMd(dbPage: Page, ctx: MdContext): string {
  const schema = dbPage.dbSchema ?? [];
  const rows = ctx.rowsByDb.get(dbPage.id) ?? [];
  const header = ["Nome", ...schema.map((d) => d.name)];
  const lines = [`| ${header.map(escapeMd).join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const r of rows) {
    const cells = [
      `[${escapeMd(r.title || "Sem título")}](${encodeURI(ctx.pagePath(r.id))})`,
      ...schema.map((d) => escapeMd(formatValue(r.properties?.[d.id], d))),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

export function blocksToMarkdown(blocks: unknown[], ctx: MdContext, depth = 0): string {
  const out: string[] = [];
  const indent = "    ".repeat(depth);
  let numbered = 0;
  for (const raw of blocks as AnyBlock[]) {
    const b = raw;
    const props = b.props ?? {};
    const text = inlineToMd(b.content, ctx);
    numbered = b.type === "numberedListItem" ? numbered + 1 : 0;
    let line: string;
    let childDepth = depth + 1;
    switch (b.type) {
      case "heading":
        line = `${"#".repeat(Number(props.level ?? 1))} ${text}`;
        childDepth = depth;
        break;
      case "bulletListItem":
        line = `- ${text}`;
        break;
      case "numberedListItem":
        line = `${numbered}. ${text}`;
        break;
      case "checkListItem":
        line = `- [${props.checked ? "x" : " "}] ${text}`;
        break;
      case "toggleListItem":
        line = `- ${text}`;
        break;
      case "quote":
        line = `> ${text}`;
        break;
      case "callout":
        line = `> ${props.emoji ?? "💡"} ${text}`;
        break;
      case "codeBlock": {
        const codeText = Array.isArray(b.content) ? (b.content as Inline[]).map((n) => n.text ?? "").join("") : "";
        const lang = props.language && props.language !== "text" ? String(props.language) : "";
        line = "```" + lang + "\n" + codeText + "\n```";
        break;
      }
      case "divider":
        line = "---";
        break;
      case "math":
        line = `$$\n${props.latex ?? ""}\n$$`;
        break;
      case "image":
        line = `![${escapeMd(String(props.caption || props.name || "imagem"))}](${url(props.url, ctx)})`;
        break;
      case "video":
      case "audio":
      case "file":
      case "pdf":
        line = `[📎 ${escapeMd(String(props.name || props.caption || "arquivo"))}](${url(props.url, ctx)})`;
        break;
      case "embed":
        line = `[${props.url}](${props.url})`;
        break;
      case "subpage": {
        const p = ctx.pages.get(String(props.pageId));
        line = p ? `📄 [${escapeMd(p.title || "Sem título")}](${encodeURI(ctx.pagePath(p.id))})` : "";
        break;
      }
      case "database": {
        const p = ctx.pages.get(String(props.databaseId));
        line = p ? `**${escapeMd(p.title || "Banco de dados")}**\n\n${databaseToMd(p, ctx)}` : "";
        break;
      }
      case "table": {
        const rows = ((b.content as { rows?: { cells: unknown[] }[] })?.rows ?? []).map((r) => r.cells.map((c) => cellText(c, ctx)));
        if (!rows.length) {
          line = "";
          break;
        }
        const width = Math.max(...rows.map((r) => r.length));
        const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
        line = [`| ${pad(rows[0]).join(" | ")} |`, `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`)].join("\n");
        break;
      }
      default:
        line = text;
    }
    if (line) out.push(line.split("\n").map((l) => indent + l).join("\n"));
    else if (b.type === "paragraph") out.push("");
    if (b.children?.length) out.push(blocksToMarkdown(b.children, ctx, childDepth));
  }
  // Itens de lista consecutivos ficam juntos; demais blocos separados por linha em branco.
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

export function pageToMarkdown(page: Page, ctx: MdContext): string {
  const parts: string[] = [`# ${page.icon ? page.icon + " " : ""}${page.title || "Sem título"}`];
  if (page.kind === "row") {
    const parent = page.parentId ? ctx.pages.get(page.parentId) : undefined;
    for (const d of parent?.dbSchema ?? []) {
      const v = formatValue(page.properties?.[d.id], d);
      if (v) parts.push(`**${escapeMd(d.name)}:** ${escapeMd(v)}`);
    }
  }
  if (page.kind === "database") parts.push(databaseToMd(page, ctx));
  const body = blocksToMarkdown(page.content ?? [], ctx);
  if (body.trim()) parts.push(body);
  return parts.join("\n\n") + "\n";
}
