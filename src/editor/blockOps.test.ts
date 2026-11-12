import { describe, expect, it } from "vitest";
import { appendBlocks, cloneWithoutIds, linkedPageIds } from "./blockOps";

describe("menu do bloco", () => {
  it("duplicar remove os ids do bloco e dos filhos", () => {
    const copy = cloneWithoutIds({ id: "a", type: "paragraph", props: { x: 1 }, children: [{ id: "b", type: "paragraph", props: { x: 2 }, children: [] }] });
    expect(copy).toEqual({ type: "paragraph", props: { x: 1 }, children: [{ type: "paragraph", props: { x: 2 }, children: [] }] });
  });

  it("encontra subpáginas e bancos de dados, inclusive em filhos", () => {
    const ids = linkedPageIds([
      { type: "subpage", props: { pageId: "p1" } },
      { type: "paragraph", children: [{ type: "database", props: { databaseId: "d1" } }] },
    ]);
    expect(ids).toEqual(["p1", "d1"]);
  });

  it("acrescenta no fim sem deixar linhas vazias no meio", () => {
    const texto = { type: "paragraph", content: [{ type: "text", text: "oi" }], children: [] };
    const vazio = { type: "paragraph", content: [], children: [] };
    const novo = { type: "callout" };
    expect(appendBlocks([texto, vazio, vazio], [novo])).toEqual([texto, novo]);
    expect(appendBlocks([vazio], [novo])).toEqual([novo]);
    expect(appendBlocks([], [novo])).toEqual([novo]);
  });
});
