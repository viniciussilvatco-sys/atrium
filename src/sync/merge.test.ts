import { describe, expect, it } from "vitest";
import { mergePage, mergeSimple, pickWinner } from "./merge";
import type { Page } from "../db/types";

function page(over: Partial<Page> = {}): Page {
  return {
    id: "p1",
    profileId: "pr",
    parentId: null,
    kind: "page",
    title: "Título",
    icon: "",
    cover: null,
    content: [],
    text: "",
    properties: {},
    favorite: false,
    order: 0,
    trashedAt: null,
    createdAt: 1,
    updatedAt: 100,
    deviceId: "A",
    ...over,
  };
}

describe("pickWinner", () => {
  it("prefere o updatedAt maior", () => {
    expect(pickWinner(page({ updatedAt: 1 }), page({ updatedAt: 2 }))).toBe("remote");
    expect(pickWinner(page({ updatedAt: 3 }), page({ updatedAt: 2 }))).toBe("local");
  });
  it("desempata pelo deviceId", () => {
    expect(pickWinner(page({ deviceId: "A" }), page({ deviceId: "B" }))).toBe("remote");
    expect(pickWinner(page({ deviceId: "B" }), page({ deviceId: "A" }))).toBe("local");
  });
  it("reconhece versões idênticas", () => {
    expect(pickWinner(page(), page())).toBe("same");
  });
  it("tombstone sempre vence, mesmo se mais antigo", () => {
    expect(pickWinner(page({ updatedAt: 999 }), page({ updatedAt: 1, deleted: true }))).toBe("remote");
    expect(pickWinner(page({ updatedAt: 1, deleted: true }), page({ updatedAt: 999 }))).toBe("local");
  });
});

describe("mergePage", () => {
  it("grava a remota quando não existe local", () => {
    const r = page();
    expect(mergePage(undefined, r, false)).toEqual({ write: r, pushBack: false, clearDirty: false });
  });

  it("aceita a remota mais nova quando não há edição local", () => {
    const r = page({ updatedAt: 200, title: "Novo" });
    const res = mergePage(page(), r, false);
    expect(res.write).toEqual(r);
    expect(res.pushBack).toBe(false);
  });

  it("reenvia a local quando ela é mais nova e o Drive está desatualizado", () => {
    const res = mergePage(page({ updatedAt: 300 }), page({ updatedAt: 200 }), false);
    expect(res.write).toBeUndefined();
    expect(res.pushBack).toBe(true);
  });

  it("guarda a versão local como conflito quando a remota vence com edições dos dois lados", () => {
    const local = page({ updatedAt: 150, title: "Editado no PC", deviceId: "A" });
    const remote = page({ updatedAt: 200, title: "Editado no celular", deviceId: "B" });
    const res = mergePage(local, remote, true);
    expect(res.write?.title).toBe("Editado no celular");
    expect(res.write?.conflicts?.[0].title).toBe("Editado no PC");
    expect(res.write!.updatedAt).toBeGreaterThan(remote.updatedAt);
    expect(res.pushBack).toBe(true);
  });

  it("guarda a versão remota como conflito quando a local vence com edições dos dois lados", () => {
    const local = page({ updatedAt: 300, title: "Local", deviceId: "A" });
    const remote = page({ updatedAt: 200, title: "Remota", deviceId: "B" });
    const res = mergePage(local, remote, true);
    expect(res.write?.title).toBe("Local");
    expect(res.write?.conflicts?.[0].title).toBe("Remota");
    expect(res.pushBack).toBe(true);
  });

  it("não cria conflito se o conteúdo é igual", () => {
    const res = mergePage(page({ updatedAt: 150 }), page({ updatedAt: 200, deviceId: "B" }), true);
    expect(res.write?.conflicts).toBeUndefined();
    expect(res.clearDirty).toBe(true);
  });

  it("exclusão remota prevalece sobre edição local", () => {
    const res = mergePage(page({ updatedAt: 500, title: "x" }), page({ updatedAt: 100, deleted: true, title: "" }), true);
    expect(res.write?.deleted).toBe(true);
    expect(res.write?.conflicts).toBeUndefined();
  });

  it("é idempotente: aplicar a mesma remota duas vezes não muda nada", () => {
    const r = page({ updatedAt: 200 });
    const first = mergePage(page(), r, false);
    const second = mergePage(first.write, r, false);
    expect(second.write).toBeUndefined();
    expect(second.pushBack).toBe(false);
  });

  it("limita o histórico de conflitos", () => {
    const conflicts = Array.from({ length: 15 }, (_, i) => ({ at: i, deviceId: "Z", title: `c${i}`, content: [] }));
    const res = mergePage(page({ updatedAt: 150, title: "L" }), page({ updatedAt: 200, title: "R", deviceId: "B", conflicts }), true);
    expect(res.write!.conflicts!.length).toBe(10);
    expect(res.write!.conflicts![0].title).toBe("L");
  });
});

describe("mergeSimple", () => {
  it("descarta a pendência local quando a remota vence", () => {
    const res = mergeSimple({ updatedAt: 1, deviceId: "A" }, { updatedAt: 2, deviceId: "B" }, true);
    expect(res.clearDirty).toBe(true);
    expect(res.write).toBeDefined();
  });
});
