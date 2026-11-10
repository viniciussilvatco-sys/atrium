import { describe, expect, it } from "vitest";
import { pushRecent, RECENT_GROUP, slashItemId, withRecents } from "./recentSlash";

describe("pushRecent", () => {
  it("coloca o item usado no início, sem repetir, com no máximo 5", () => {
    expect(pushRecent([], "a")).toEqual(["a"]);
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b", "c", "d", "e"], "f")).toEqual(["f", "a", "b", "c", "d"]);
  });
});

describe("withRecents", () => {
  const items = [
    { key: "heading", title: "Título", group: "Títulos" },
    { key: "quote", title: "Citação", group: "Blocos básicos" },
    { title: "Fórmula (LaTeX)", group: "Atrium" },
  ];

  it("põe cópias dos recentes no topo, na ordem de uso, e mantém a lista completa", () => {
    const out = withRecents(items, ["Fórmula (LaTeX)", "heading", "sumiu"]);
    expect(out).toHaveLength(5);
    expect(out.slice(0, 2).map((i) => i.group)).toEqual([RECENT_GROUP, RECENT_GROUP]);
    expect(out.slice(0, 2).map(slashItemId)).toEqual(["Fórmula (LaTeX)", "heading"]);
    expect(out.slice(2)).toEqual(items);
  });

  it("as cópias têm títulos diferentes do original (chave única), mas iguais na tela", () => {
    const out = withRecents(items, ["Fórmula (LaTeX)"]);
    expect(out[0].title).not.toBe("Fórmula (LaTeX)");
    expect(out[0].title.trim().replace(/​/g, "")).toBe("Fórmula (LaTeX)");
  });

  it("sem recentes, devolve a lista igual", () => {
    expect(withRecents(items, [])).toEqual(items);
  });
});
