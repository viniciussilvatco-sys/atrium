import { describe, expect, it } from "vitest";
import {
  MARK,
  buildParents,
  csvToMarkdownTable,
  parseNotionName,
  postprocessBlocks,
  preprocessNotionMarkdown,
  resolvePath,
  type PostContext,
} from "./notionParse";

describe("nomes e caminhos do Notion", () => {
  it("remove o id de 32 caracteres do nome", () => {
    expect(parseNotionName("Aula 1 0123456789abcdef0123456789abcdef.md")).toEqual({
      title: "Aula 1",
      base: "Aula 1 0123456789abcdef0123456789abcdef",
    });
    expect(parseNotionName("Sem id.md").title).toBe("Sem id");
  });

  it("resolve caminhos relativos", () => {
    expect(resolvePath("A/B", "C/img.png")).toBe("A/B/C/img.png");
    expect(resolvePath("A/B", "../x.md")).toBe("A/x.md");
    expect(resolvePath("", "./y.md")).toBe("y.md");
  });

  it("descobre a hierarquia pelas pastas, ignorando pastas sem página", () => {
    const parents = buildParents([
      "Private & Shared/Curso abc.md",
      "Private & Shared/Curso abc/Aula 1 def.md",
      "Private & Shared/Curso abc/Aula 1 def/Detalhe ghi.md",
      "Private & Shared/Solta jkl.md",
    ]);
    expect(parents.get("Private & Shared/Curso abc.md")).toBeNull();
    expect(parents.get("Private & Shared/Curso abc/Aula 1 def.md")).toBe("Private & Shared/Curso abc.md");
    expect(parents.get("Private & Shared/Curso abc/Aula 1 def/Detalhe ghi.md")).toBe("Private & Shared/Curso abc/Aula 1 def.md");
    expect(parents.get("Private & Shared/Solta jkl.md")).toBeNull();
  });
});

describe("preprocessNotionMarkdown", () => {
  const resolve = (href: string, isImage: boolean) => {
    if (href.includes("missing")) return null;
    if (isImage) return { kind: "image" as const, id: "img1" };
    if (href.endsWith(".md")) return { kind: "page" as const, id: "pg1" };
    return { kind: "file" as const, id: "f1", name: "doc.pdf" };
  };

  it("extrai o título e converte callouts, fórmulas e links", () => {
    const md = [
      "# Minha aula",
      "",
      "Texto com [link externo](https://exemplo.com) e [outra](Outra%20abc.md).",
      "",
      "<aside>",
      "💡 Lembrar da **prova**",
      "</aside>",
      "",
      "$$",
      "E = mc^2",
      "$$",
      "",
      "![](Minha%20aula/foto.png)",
      "",
      "[doc.pdf](Minha%20aula/doc.pdf)",
      "",
      "![](missing.png)",
    ].join("\n");
    const r = preprocessNotionMarkdown(md, resolve);
    expect(r.title).toBe("Minha aula");
    expect(r.callouts).toEqual([{ emoji: "💡", text: "Lembrar da **prova**" }]);
    expect(r.maths).toEqual(["E = mc^2"]);
    expect(r.markdown).toContain("[link externo](https://exemplo.com)");
    expect(r.markdown).toContain(`[outra](${MARK}/page/pg1)`);
    expect(r.markdown).toContain(`![](${MARK}/asset/img1)`);
    expect(r.markdown).toContain(`[doc.pdf](${MARK}/file/f1)`);
    expect(r.markdown).toContain("ATRIUMCALLOUT0");
    expect(r.markdown).toContain("ATRIUMMATH0");
    expect(r.markdown).not.toContain("missing");
  });

  it("callout sem emoji usa 💡", () => {
    expect(preprocessNotionMarkdown("<aside>Atenção</aside>", resolve).callouts[0]).toEqual({ emoji: "💡", text: "Atenção" });
  });
});

describe("csvToMarkdownTable", () => {
  it("converte CSV com aspas e vírgulas", () => {
    expect(csvToMarkdownTable('Nome,Notas\n"Silva, Ana","ótima ""aluna"""\nBruno,ok\n')).toBe(
      '| Nome | Notas |\n| --- | --- |\n| Silva, Ana | ótima "aluna" |\n| Bruno | ok |',
    );
  });
});

describe("postprocessBlocks", () => {
  const ctx: PostContext = {
    pageTitle: (id) => (id === "child" ? "Filha" : "Outra"),
    isChild: (id) => id === "child",
    assetName: () => "doc.pdf",
    assetIsPdf: () => true,
    callouts: [{ emoji: "⚠️", text: "Cuidado" }],
    maths: ["x^2"],
    calloutInline: (t) => [{ type: "text", text: t, styles: {} }],
  };
  const link = (href: string, text: string) => ({ type: "link", href, content: [{ type: "text", text, styles: {} }] });

  it("converte marcadores, subpáginas, menções, arquivos e imagens", () => {
    const out = postprocessBlocks(
      [
        { type: "paragraph", content: [{ type: "text", text: "ATRIUMCALLOUT0", styles: {} }] },
        { type: "paragraph", content: [{ type: "text", text: "ATRIUMMATH0", styles: {} }] },
        { type: "paragraph", content: [link(`${MARK}/page/child`, "Filha")] },
        { type: "paragraph", content: [{ type: "text", text: "veja ", styles: {} }, link(`${MARK}/page/other`, "Outra")] },
        { type: "paragraph", content: [link(`${MARK}/file/f1`, "doc.pdf")] },
        { type: "image", props: { url: `${MARK}/asset/img1` } },
      ],
      ctx,
    );
    expect(out[0]).toEqual({ type: "callout", props: { emoji: "⚠️" }, content: [{ type: "text", text: "Cuidado", styles: {} }] });
    expect(out[1]).toEqual({ type: "math", props: { latex: "x^2" } });
    expect(out[2]).toEqual({ type: "subpage", props: { pageId: "child" } });
    expect((out[3].content as { type: string }[])[1]).toEqual({ type: "pageLink", props: { pageId: "other", title: "Outra" } });
    expect(out[4]).toEqual({ type: "pdf", props: { url: "asset://f1", name: "doc.pdf" } });
    expect(out[5].props?.url).toBe("asset://img1");
  });
});
