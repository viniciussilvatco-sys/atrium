import { describe, expect, it } from "vitest";
import { backupAgeLabel, backupDue, snoozeUntil } from "./backup";

const DAY = 24 * 3600 * 1000;
const NOW = new Date(2026, 10, 11, 12, 0).getTime();

describe("lembrete de backup", () => {
  it("lembra quem nunca fez backup", () => {
    expect(backupDue(null, null, NOW)).toBe(true);
  });
  it("não lembra antes de 7 dias", () => {
    expect(backupDue(NOW - 6 * DAY, null, NOW)).toBe(false);
    expect(backupDue(NOW - 7 * DAY, null, NOW)).toBe(true);
  });
  it("'Depois' adia por 3 dias", () => {
    const snooze = snoozeUntil(NOW);
    expect(backupDue(null, snooze, NOW + 2 * DAY)).toBe(false);
    expect(backupDue(null, snooze, NOW + 3 * DAY)).toBe(true);
  });
  it("texto da idade do backup", () => {
    expect(backupAgeLabel(null, NOW)).toBe("nunca");
    expect(backupAgeLabel(NOW - 1000, NOW)).toBe("hoje");
    expect(backupAgeLabel(NOW - DAY, NOW)).toBe("ontem");
    expect(backupAgeLabel(NOW - 9 * DAY, NOW)).toBe("há 9 dias");
  });
});
