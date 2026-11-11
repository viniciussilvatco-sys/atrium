// Regras do histórico de versões das páginas (funções puras, testadas em versions.test.ts).
//
// Enquanto você edita, o Atrium guarda uma "foto" da página no máximo a cada 10 minutos.
// Fotos antigas vão sendo raleadas: tudo dos últimos 2 dias, depois uma por dia até 30 dias.
// As 3 fotos mais recentes de cada página são sempre mantidas, por mais antigas que sejam.

export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
export const KEEP_ALL_MS = 2 * 24 * 3600 * 1000;
export const KEEP_DAILY_MS = 30 * 24 * 3600 * 1000;
export const ALWAYS_KEEP = 3;

export interface VersionContent {
  title: string;
  icon?: string;
  content: unknown[];
  properties?: Record<string, unknown>;
}

function fingerprint(v: VersionContent): string {
  return JSON.stringify([v.title ?? "", v.icon ?? "", v.content ?? [], v.properties ?? {}]);
}

export function sameVersionContent(a: VersionContent, b: VersionContent): boolean {
  return fingerprint(a) === fingerprint(b);
}

/** Página sem nada que valha guardar (recém-criada). */
export function isBlankVersion(v: VersionContent): boolean {
  const blankContent =
    !v.content?.length ||
    (v.content.length === 1 &&
      (v.content[0] as { type?: string; content?: unknown[]; children?: unknown[] }).type === "paragraph" &&
      !(v.content[0] as { content?: unknown[] }).content?.length &&
      !(v.content[0] as { children?: unknown[] }).children?.length);
  return !v.title?.trim() && blankContent && !Object.keys(v.properties ?? {}).length;
}

/**
 * Decide se o estado atual (antes de uma edição) deve virar uma versão no histórico.
 * `last` é a versão mais recente já guardada desta página; `savedAt` é quando ela foi guardada
 * (`at` é quando aquele conteúdo foi editado pela última vez).
 */
export function shouldSnapshot(
  current: VersionContent,
  last: (VersionContent & { at: number; savedAt?: number }) | undefined,
  now: number,
  force = false,
): boolean {
  if (isBlankVersion(current)) return false;
  if (last && sameVersionContent(current, last)) return false;
  if (force || !last) return true;
  return now - (last.savedAt ?? last.at) >= SNAPSHOT_INTERVAL_MS;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Recebe as versões de UMA página e devolve os ids que podem ser apagados.
 * `pageGone` = a página foi excluída definitivamente (aí só sobra o que tiver menos de 30 dias).
 */
export function versionsToPrune(versions: { id: string; at: number }[], now: number, pageGone = false): string[] {
  const sorted = [...versions].sort((a, b) => b.at - a.at);
  const remove: string[] = [];
  const daysSeen = new Set<string>();
  sorted.forEach((v, i) => {
    const age = now - v.at;
    if (age > KEEP_DAILY_MS) {
      if (pageGone || i >= ALWAYS_KEEP) remove.push(v.id);
      return;
    }
    if (age <= KEEP_ALL_MS || i < ALWAYS_KEEP) return;
    // Entre 2 e 30 dias: fica só a mais recente de cada dia.
    const key = dayKey(v.at);
    if (daysSeen.has(key)) remove.push(v.id);
    else daysSeen.add(key);
  });
  return remove;
}
