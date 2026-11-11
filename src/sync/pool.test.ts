import { describe, expect, it } from "vitest";
import { runPool, sortForPull } from "./pool";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runPool", () => {
  it("processa tudo respeitando o limite de tarefas simultâneas", async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await wait(5);
      done.push(n);
      running--;
    });
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(peak).toBe(3);
  });

  it("para de começar novos itens depois de um erro e lança o erro", async () => {
    const started: number[] = [];
    await expect(
      runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n);
        await wait(5);
        if (n === 2) throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");
    expect(started.length).toBeLessThan(6);
  });

  it("lista vazia não faz nada", async () => {
    await runPool([], 6, async () => {
      throw new Error("não deveria rodar");
    });
  });
});

describe("sortForPull", () => {
  it("perfis, depois páginas, depois arquivos; cada grupo por data", () => {
    const f = (name: string, t: string) => ({ id: name, name, modifiedTime: t });
    const out = sortForPull([f("asset-a", "1"), f("page-b", "3"), f("profile-c", "9"), f("page-a", "2")]);
    expect(out.map((x) => x.name)).toEqual(["profile-c", "page-a", "page-b", "asset-a"]);
  });
});
