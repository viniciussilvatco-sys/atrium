// Lembrete de backup: regras puras (testadas em backup.test.ts).

const DAY = 24 * 3600 * 1000;
/** De quantos em quantos dias o Atrium lembra de fazer um backup. */
export const BACKUP_EVERY_DAYS = 7;
/** "Depois" adia o lembrete por este número de dias. */
export const BACKUP_SNOOZE_DAYS = 3;

export function backupDue(lastBackup: number | null, snoozeUntil: number | null, now: number): boolean {
  if (snoozeUntil && now < snoozeUntil) return false;
  return !lastBackup || now - lastBackup >= BACKUP_EVERY_DAYS * DAY;
}

export function snoozeUntil(now: number): number {
  return now + BACKUP_SNOOZE_DAYS * DAY;
}

export function daysSince(ts: number, now: number): number {
  return Math.floor((now - ts) / DAY);
}

/** Texto curto: "hoje", "ontem", "há 9 dias". */
export function backupAgeLabel(lastBackup: number | null, now: number): string {
  if (!lastBackup) return "nunca";
  const d = daysSince(lastBackup, now);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}
