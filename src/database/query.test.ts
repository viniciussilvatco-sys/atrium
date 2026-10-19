import { describe, expect, it } from "vitest";
import { applyView, formatValue, matchFilter } from "./query";
import type { DbView, Page, PropDef } from "../db/types";

const schema: PropDef[] = [
  { id: "st", name: "Status", type: "status", options: [
    { id: "todo", name: "A fazer", color: "gray" },
    { id: "doing", name: "Em andamento", color: "blue" },
    { id: "done", name: "Concluído", color: "green" },
  ] },
  { id: "tags", name: "Tags", type: "multiselect", options: [
    { id: "a", name: "Prova", color: "red" },
    { id: "b", name: "Leitura", color: "blue" },
  ] },
  { id: "n", name: "Nota", type: "number" },
  { id: "d", name: "Data", type: "date" },
  { id: "c", name: "Feito", type: "checkbox" },
];

function row(title: string, properties: Record<string, unknown>, order = 0): Page {
  return {
    id: title, profileId: "p", parentId: "db", kind: "row", title, icon: "", cover: null, content: [], text: "",
    properties, favorite: false, order, trashedAt: null, createdAt: 0, updatedAt: 0, deviceId: "x",
  };
}

const rows = [
  row("Cálculo", { st: "doing", tags: ["a"], n: 7, d: "2026-10-20", c: true }),
  row("Álgebra", { st: "done", tags: ["a", "b"], n: 9.5, d: "2026-09-01" }),
  row("Física", { st: "todo", n: 5 }),
  row("História", {}),
];

const view = (over: Partial<DbView> = {}): DbView => ({ id: "v", name: "v", type: "table", filters: [], sorts: [], ...over });

describe("filtros", () => {
  it("texto contém (sem diferenciar maiúsculas)", () => {
    expect(matchFilter(rows[0], { id: "1", propId: "title", op: "contains", value: "cál" }, schema)).toBe(true);
  });
  it("multisseleção contém", () => {
    const out = applyView(rows, view({ filters: [{ id: "1", propId: "tags", op: "contains", value: "b" }] }), schema);
    expect(out.map((r) => r.title)).toEqual(["Álgebra"]);
  });
  it("número maior que e vazio", () => {
    expect(applyView(rows, view({ filters: [{ id: "1", propId: "n", op: "gt", value: "6" }] }), schema)).toHaveLength(2);
    expect(applyView(rows, view({ filters: [{ id: "1", propId: "n", op: "isEmpty" }] }), schema).map((r) => r.title)).toEqual(["História"]);
  });
  it("datas antes/depois", () => {
    expect(applyView(rows, view({ filters: [{ id: "1", propId: "d", op: "after", value: "2026-10-01" }] }), schema).map((r) => r.title)).toEqual(["Cálculo"]);
  });
  it("checkbox", () => {
    expect(applyView(rows, view({ filters: [{ id: "1", propId: "c", op: "unchecked" }] }), schema)).toHaveLength(3);
  });
  it("filtro sem valor não esconde linhas", () => {
    expect(applyView(rows, view({ filters: [{ id: "1", propId: "st", op: "equals", value: "" }] }), schema)).toHaveLength(4);
  });
});

describe("ordenação", () => {
  it("ordena por título com acentos (pt-BR)", () => {
    const out = applyView(rows, view({ sorts: [{ propId: "title", dir: "asc" }] }), schema);
    expect(out.map((r) => r.title)).toEqual(["Álgebra", "Cálculo", "Física", "História"]);
  });
  it("ordena número decrescente com vazios no final", () => {
    const out = applyView(rows, view({ sorts: [{ propId: "n", dir: "desc" }] }), schema);
    expect(out.map((r) => r.title)).toEqual(["Álgebra", "Cálculo", "Física", "História"]);
  });
  it("status segue a ordem das opções", () => {
    const out = applyView(rows, view({ sorts: [{ propId: "st", dir: "asc" }] }), schema);
    expect(out.map((r) => r.title)).toEqual(["Física", "Cálculo", "Álgebra", "História"]);
  });
});

describe("formatValue", () => {
  it("mostra nomes das opções", () => {
    expect(formatValue(["a", "b"], schema[1])).toBe("Prova, Leitura");
    expect(formatValue("done", schema[0])).toBe("Concluído");
    expect(formatValue(undefined, schema[0])).toBe("");
  });
});
