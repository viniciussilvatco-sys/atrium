import { db } from "../db/schema";
import { createRow, updatePage } from "../db/repo";
import type { DbView, Page, PropDef, PropType, SelectOption, ViewType } from "../db/types";
import { newId } from "../lib/ids";
import { TAG_COLORS } from "./query";

export async function setRowProp(rowId: string, propId: string, value: unknown) {
  const row = await db.pages.get(rowId);
  if (!row) return;
  await updatePage(rowId, { properties: { ...row.properties, [propId]: value } });
}

async function patchDb(dbId: string, fn: (p: Page) => Partial<Page>) {
  const page = await db.pages.get(dbId);
  if (!page) return;
  await updatePage(dbId, fn(page));
}

export async function addProperty(dbId: string, type: PropType, name?: string): Promise<string> {
  const id = newId();
  await patchDb(dbId, (p) => {
    const schema = p.dbSchema ?? [];
    const base = name ?? defaultPropName(type);
    let finalName = base;
    let i = 2;
    while (schema.some((s) => s.name === finalName)) finalName = `${base} ${i++}`;
    const def: PropDef = { id, name: finalName, type };
    if (type === "select" || type === "multiselect") def.options = [];
    if (type === "status")
      def.options = [
        { id: newId(), name: "A fazer", color: "gray" },
        { id: newId(), name: "Em andamento", color: "blue" },
        { id: newId(), name: "Concluído", color: "green" },
      ];
    return { dbSchema: [...schema, def] };
  });
  return id;
}

function defaultPropName(type: PropType): string {
  return (
    {
      text: "Texto",
      number: "Número",
      select: "Seleção",
      multiselect: "Tags",
      status: "Status",
      date: "Data",
      checkbox: "Concluído",
      url: "Link",
    } as Record<PropType, string>
  )[type];
}

export async function updateProperty(dbId: string, propId: string, patch: Partial<PropDef>) {
  await patchDb(dbId, (p) => ({
    dbSchema: (p.dbSchema ?? []).map((d) => {
      if (d.id !== propId) return d;
      const next = { ...d, ...patch };
      if (patch.type && ["select", "multiselect", "status"].includes(patch.type) && !next.options) next.options = [];
      return next;
    }),
  }));
}

/** Ao trocar o tipo de uma propriedade, converte os valores existentes quando possível. */
export async function changePropertyType(dbId: string, propId: string, type: PropType) {
  const dbPage = await db.pages.get(dbId);
  const def = dbPage?.dbSchema?.find((d) => d.id === propId);
  if (!dbPage || !def || def.type === type) return;
  await updateProperty(dbId, propId, { type });
  const rows = await db.pages.where("parentId").equals(dbId).toArray();
  for (const r of rows) {
    const v = r.properties?.[propId];
    if (v === undefined) continue;
    let next: unknown = undefined;
    const isOption = (t: PropType) => t === "select" || t === "status";
    if (isOption(def.type) && type === "multiselect") next = v ? [v] : [];
    else if (def.type === "multiselect" && isOption(type)) next = Array.isArray(v) ? v[0] : undefined;
    else if (isOption(def.type) && isOption(type)) next = v;
    else if (type === "text" || type === "url") next = typeof v === "string" || typeof v === "number" ? String(v) : undefined;
    else if (type === "number") next = Number.isFinite(Number(v)) && v !== "" ? Number(v) : undefined;
    const props = { ...r.properties };
    if (next === undefined) delete props[propId];
    else props[propId] = next;
    await updatePage(r.id, { properties: props });
  }
}

export async function deleteProperty(dbId: string, propId: string) {
  await patchDb(dbId, (p) => ({
    dbSchema: (p.dbSchema ?? []).filter((d) => d.id !== propId),
    views: (p.views ?? []).map((v) => ({
      ...v,
      filters: v.filters.filter((f) => f.propId !== propId),
      sorts: v.sorts.filter((s) => s.propId !== propId),
      groupBy: v.groupBy === propId ? undefined : v.groupBy,
      dateProp: v.dateProp === propId ? undefined : v.dateProp,
    })),
  }));
}

export async function addOption(dbId: string, propId: string, name: string): Promise<string> {
  const page = await db.pages.get(dbId);
  const def = page?.dbSchema?.find((d) => d.id === propId);
  const existing = def?.options?.find((o) => o.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const option: SelectOption = {
    id: newId(),
    name,
    color: TAG_COLORS[(def?.options?.length ?? 0) % TAG_COLORS.length],
  };
  await updateProperty(dbId, propId, { options: [...(def?.options ?? []), option] });
  return option.id;
}

export async function updateOption(dbId: string, propId: string, optionId: string, patch: Partial<SelectOption>) {
  const page = await db.pages.get(dbId);
  const def = page?.dbSchema?.find((d) => d.id === propId);
  if (!def) return;
  await updateProperty(dbId, propId, { options: (def.options ?? []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) });
}

export async function deleteOption(dbId: string, propId: string, optionId: string) {
  const page = await db.pages.get(dbId);
  const def = page?.dbSchema?.find((d) => d.id === propId);
  if (!def) return;
  await updateProperty(dbId, propId, { options: (def.options ?? []).filter((o) => o.id !== optionId) });
}

export async function updateView(dbId: string, viewId: string, patch: Partial<DbView>) {
  await patchDb(dbId, (p) => ({ views: (p.views ?? []).map((v) => (v.id === viewId ? { ...v, ...patch } : v)) }));
}

export const VIEW_LABELS: Record<ViewType, { label: string; icon: string }> = {
  table: { label: "Tabela", icon: "▦" },
  board: { label: "Quadro", icon: "▥" },
  calendar: { label: "Calendário", icon: "📅" },
  list: { label: "Lista", icon: "☰" },
};

export async function addView(dbId: string, type: ViewType): Promise<string> {
  const id = newId();
  const page = await db.pages.get(dbId);
  if (!page) return id;
  const schema = page.dbSchema ?? [];
  let groupBy: string | undefined;
  let dateProp: string | undefined;
  if (type === "board") {
    groupBy = schema.find((d) => d.type === "status" || d.type === "select")?.id;
    if (!groupBy) groupBy = await addProperty(dbId, "status");
  }
  if (type === "calendar") {
    dateProp = schema.find((d) => d.type === "date")?.id;
    if (!dateProp) dateProp = await addProperty(dbId, "date");
  }
  const view: DbView = { id, name: VIEW_LABELS[type].label, type, filters: [], sorts: [], groupBy, dateProp };
  await patchDb(dbId, (p) => ({ views: [...(p.views ?? []), view] }));
  return id;
}

export async function deleteView(dbId: string, viewId: string) {
  await patchDb(dbId, (p) => ({ views: (p.views ?? []).filter((v) => v.id !== viewId) }));
}

/** Cria uma linha já preenchida para satisfazer os filtros "é" da visão (como no Notion). */
export async function createRowForView(dbPage: Page, view: DbView | undefined, extra: Record<string, unknown> = {}) {
  const props: Record<string, unknown> = {};
  for (const f of view?.filters ?? []) {
    const def = dbPage.dbSchema?.find((d) => d.id === f.propId);
    if (!def || !f.value) continue;
    if (f.op === "equals" && (def.type === "select" || def.type === "status" || def.type === "text")) props[def.id] = f.value;
    if (f.op === "contains" && def.type === "multiselect") props[def.id] = [f.value];
  }
  if (view?.filters.some((f) => f.op === "checked")) {
    const f = view.filters.find((x) => x.op === "checked")!;
    props[f.propId] = true;
  }
  const rows = await db.pages.where("parentId").equals(dbPage.id).toArray();
  const order = rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0;
  const row = await createRow(dbPage, { ...props, ...extra });
  if (row.order !== order) await updatePage(row.id, { order });
  return row;
}
