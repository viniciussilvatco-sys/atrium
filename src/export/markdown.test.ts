import { describe, expect, it } from "vitest";
import { blocksToMarkdown, pageToMarkdown, type MdContext } from "./markdown";
import type { Page } from "../db/types";

function mkPage(over: Partial<Page>): Page {
  return {
    id: "x", profileId: "p", parentId: null, kind: "page", title: "", icon: "", cover: null, content: [], text: "",
    properties: {}, favorite: false, order: 0, trashedAt: null, createdAt: 0, updatedAt: 0, deviceId: "d", ...over,
  };
}

const other = mkPage({ id: "other", title: "Outra página" });
const dbPage = mkPage({
  id: "db1", kind: "database", title: "Tarefas",
  dbSchema: [{ id: "st", name: "Status", type: "status", options: [{ id: "done", name: "Concluído", color: "green" }] }],
});
const row = mkPage({ id: "r1", kind: "row", parentId: "db1", title: "Estudar", properties: { st: "done" } });

const ctx: MdContext = {
  pages: new Map([["other", other], ["db1", dbPage], ["r1", row]]),
  rowsByDb: new Map([["db1", [row]]]),
  assetPath: (id) => `arquivos/${id}.png`,
  pagePath: (id) => `${id}.md`,
};

const txt = (text: string, styles = {}) => ({ type: "text", text, styles });

describe("blocksToMarkdown", () => {
  it("converte títulos, listas e estilos", () => {
    const md = blocksToMarkdown(
      [
        { type: "heading", props: { level: 2 }, content: [txt("Resumo")] },
        { type: "paragraph", content: [txt("texto "), txt("forte", { bold: true }), txt(" e "), txt("código", { code: true })] },
        { type: "bulletListItem", content: [txt("item")], children: [{ type: "bulletListItem", content: [txt("sub")] }] },
        { type: "numberedListItem", content: [txt("um")] },
        { type: "numberedListItem", content: [txt("dois")] },
        { type: "checkListItem", props: { checked: true }, content: [txt("feito")] },
      ],
      ctx,
    );
    expect(md).toContain("## Resumo");
    expect(md).toContain("texto **forte** e `código`");
    expect(md).toContain("- item\n\n    - sub");
    expect(md).toContain("1. um\n\n2. dois");
    expect(md).toContain("- [x] feito");
  });

  it("converte código, fórmula, imagem e link de página", () => {
    const md = blocksToMarkdown(
      [
        { type: "codeBlock", props: { language: "python" }, content: [txt("print(1)")] },
        { type: "math", props: { latex: "E=mc^2" } },
        { type: "image", props: { url: "asset://abc123", caption: "foto" } },
        { type: "paragraph", content: [{ type: "pageLink", props: { pageId: "other", title: "x" } }] },
      ],
      ctx,
    );
    expect(md).toContain("```python\nprint(1)\n```");
    expect(md).toContain("$$\nE=mc^2\n$$");
    expect(md).toContain("![foto](arquivos/abc123.png)");
    expect(md).toContain("[Outra página](other.md)");
  });

  it("converte tabelas simples", () => {
    const md = blocksToMarkdown(
      [{ type: "table", content: { type: "tableContent", rows: [{ cells: [[txt("A")], [txt("B")]] }, { cells: [[txt("1")], [txt("2")]] }] } }],
      ctx,
    );
    expect(md).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("escapa caracteres especiais", () => {
    expect(blocksToMarkdown([{ type: "paragraph", content: [txt("a*b_c")] }], ctx)).toBe("a\\*b\\_c");
  });
});

describe("pageToMarkdown", () => {
  it("inclui a tabela do banco de dados", () => {
    const md = pageToMarkdown(dbPage, ctx);
    expect(md).toContain("# Tarefas");
    expect(md).toContain("| Nome | Status |");
    expect(md).toContain("| [Estudar](r1.md) | Concluído |");
  });
  it("inclui propriedades de linhas", () => {
    expect(pageToMarkdown(row, ctx)).toContain("**Status:** Concluído");
  });
});
