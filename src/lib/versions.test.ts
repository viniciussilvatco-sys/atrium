import { describe, expect, it } from "vitest";
import { SNAPSHOT_INTERVAL_MS, isBlankVersion, shouldSnapshot, versionsToPrune } from "./versions";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 10, 11, 12, 0).getTime();

describe("shouldSnapshot", () => {
  const page = { title: "Aula", content: [p("texto")] };

  it("guarda a primeira versão", () => {
    expect(shouldSnapshot(page, undefined, NOW)).toBe(true);
  });

  it("não guarda página em branco", () => {
    expect(isBlankVersion({ title: "", content: [{ type: "paragraph", content: [], children: [] }] })).toBe(true);
    expect(shouldSnapshot({ title: "", content: [] }, undefined, NOW)).toBe(false);
  });

  it("espera 10 minutos entre versões", () => {
    const last = { title: "Aula", content: [p("antes")], at: NOW - 5 * 60 * 1000 };
    expect(shouldSnapshot(page, last, NOW)).toBe(false);
    expect(shouldSnapshot(page, { ...last, at: NOW - SNAPSHOT_INTERVAL_MS }, NOW)).toBe(true);
  });

  it("forçar ignora o intervalo, mas não duplica conteúdo igual", () => {
    expect(shouldSnapshot(page, { title: "Aula", content: [p("antes")], at: NOW - 1000 }, NOW, true)).toBe(true);
    expect(shouldSnapshot(page, { ...page, at: NOW - DAY }, NOW, true)).toBe(false);
  });
});

describe("versionsToPrune", () => {
  it("mantém tudo dos últimos 2 dias", () => {
    const vs = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, at: NOW - i * 60 * 60 * 1000 }));
    expect(versionsToPrune(vs, NOW)).toEqual([]);
  });

  it("entre 2 e 30 dias mantém uma por dia", () => {
    const base = NOW - 5 * DAY;
    const vs = [
      { id: "recente1", at: NOW - 1000 },
      { id: "recente2", at: NOW - 2000 },
      { id: "recente3", at: NOW - 3000 },
      { id: "dia5-tarde", at: base + 3 * 3600 * 1000 },
      { id: "dia5-manha", at: base },
      { id: "dia6", at: base - DAY },
    ];
    expect(versionsToPrune(vs, NOW)).toEqual(["dia5-manha"]);
  });

  it("apaga as mais velhas que 30 dias, mas sempre deixa as 3 mais recentes", () => {
    const vs = [1, 2, 3, 4].map((n) => ({ id: `v${n}`, at: NOW - (40 + n) * DAY }));
    expect(versionsToPrune(vs, NOW)).toEqual(["v4"]);
  });

  it("de páginas excluídas definitivamente, apaga tudo com mais de 30 dias", () => {
    const vs = [
      { id: "nova", at: NOW - DAY },
      { id: "velha", at: NOW - 40 * DAY },
    ];
    expect(versionsToPrune(vs, NOW, true)).toEqual(["velha"]);
  });
});
