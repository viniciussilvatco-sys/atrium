import type { DbFilter, DbView, FilterOp, Page, PropDef, PropType } from "../db/types";

export const TAG_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

export const PROP_TYPE_LABELS: Record<PropType, { label: string; icon: string }> = {
  text: { label: "Texto", icon: "≡" },
  number: { label: "Número", icon: "#" },
  select: { label: "Seleção", icon: "◉" },
  multiselect: { label: "Seleção múltipla", icon: "☰" },
  status: { label: "Status", icon: "◐" },
  date: { label: "Data", icon: "📅" },
  checkbox: { label: "Caixa de seleção", icon: "☑" },
  url: { label: "URL", icon: "🔗" },
};

export const FILTER_OPS: Record<PropType | "title", FilterOp[]> = {
  title: ["contains", "notContains", "equals", "isEmpty", "notEmpty"],
  text: ["contains", "notContains", "equals", "isEmpty", "notEmpty"],
  url: ["contains", "notContains", "isEmpty", "notEmpty"],
  number: ["equals", "notEquals", "gt", "lt", "isEmpty", "notEmpty"],
  select: ["equals", "notEquals", "isEmpty", "notEmpty"],
  status: ["equals", "notEquals", "isEmpty", "notEmpty"],
  multiselect: ["contains", "notContains", "isEmpty", "notEmpty"],
  date: ["equals", "before", "after", "isEmpty", "notEmpty"],
  checkbox: ["checked", "unchecked"],
};

export const FILTER_OP_LABELS: Record<FilterOp, string> = {
  contains: "contém",
  notContains: "não contém",
  equals: "é",
  notEquals: "não é",
  isEmpty: "está vazio",
  notEmpty: "não está vazio",
  checked: "marcado",
  unchecked: "desmarcado",
  gt: ">",
  lt: "<",
  before: "antes de",
  after: "depois de",
};

export const OPS_WITHOUT_VALUE: FilterOp[] = ["isEmpty", "notEmpty", "checked", "unchecked"];

export function getValue(row: Page, propId: string): unknown {
  return propId === "title" ? row.title : row.properties?.[propId];
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function propTypeOf(propId: string, schema: PropDef[]): PropType | "title" {
  if (propId === "title") return "title";
  return schema.find((p) => p.id === propId)?.type ?? "text";
}

export function matchFilter(row: Page, f: DbFilter, schema: PropDef[]): boolean {
  const type = propTypeOf(f.propId, schema);
  const v = getValue(row, f.propId);
  const target = f.value ?? "";
  switch (f.op) {
    case "isEmpty":
      return type === "checkbox" ? !v : isEmpty(v);
    case "notEmpty":
      return type === "checkbox" ? !!v : !isEmpty(v);
    case "checked":
      return v === true;
    case "unchecked":
      return v !== true;
  }
  if (target === "") return true; // filtro ainda sem valor não esconde nada
  switch (type) {
    case "multiselect": {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      if (f.op === "contains") return arr.includes(target);
      if (f.op === "notContains") return !arr.includes(target);
      return true;
    }
    case "number": {
      if (isEmpty(v)) return false;
      const n = Number(v);
      const t = Number(target);
      if (f.op === "equals") return n === t;
      if (f.op === "notEquals") return n !== t;
      if (f.op === "gt") return n > t;
      if (f.op === "lt") return n < t;
      return true;
    }
    case "date": {
      if (isEmpty(v)) return false;
      const d = String(v).slice(0, 10);
      if (f.op === "equals") return d === target;
      if (f.op === "before") return d < target;
      if (f.op === "after") return d > target;
      return true;
    }
    case "select":
    case "status":
      if (f.op === "equals") return v === target;
      if (f.op === "notEquals") return v !== target;
      return true;
    default: {
      const s = String(v ?? "").toLowerCase();
      const t = target.toLowerCase();
      if (f.op === "contains") return s.includes(t);
      if (f.op === "notContains") return !s.includes(t);
      if (f.op === "equals") return s === t;
      if (f.op === "notEquals") return s !== t;
      return true;
    }
  }
}

function sortKey(row: Page, propId: string, schema: PropDef[]): string | number | null {
  const v = getValue(row, propId);
  if (isEmpty(v)) return null;
  const def = schema.find((p) => p.id === propId);
  switch (def?.type) {
    case "number":
      return Number(v);
    case "checkbox":
      return v ? 1 : 0;
    case "select":
    case "status": {
      // Ordena pela posição da opção (como o Notion), não pelo nome.
      const idx = def.options?.findIndex((o) => o.id === v) ?? -1;
      return idx < 0 ? null : idx;
    }
    case "multiselect": {
      const names = (v as string[]).map((id) => def.options?.find((o) => o.id === id)?.name ?? "");
      return names.join(",").toLowerCase();
    }
    default:
      return String(v).toLowerCase();
  }
}

export function applyView(rows: Page[], view: DbView, schema: PropDef[]): Page[] {
  const filtered = rows.filter((r) => view.filters.every((f) => matchFilter(r, f, schema)));
  if (!view.sorts.length) return filtered;
  return [...filtered].sort((a, b) => {
    for (const s of view.sorts) {
      const ka = sortKey(a, s.propId, schema);
      const kb = sortKey(b, s.propId, schema);
      if (ka === kb) continue;
      // Vazios sempre no final, independente da direção.
      if (ka === null) return 1;
      if (kb === null) return -1;
      const cmp = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb), "pt-BR");
      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

/** Texto legível de um valor (usado em cartões, exportação e busca). */
export function formatValue(v: unknown, def: PropDef | undefined): string {
  if (isEmpty(v)) return "";
  switch (def?.type) {
    case "select":
    case "status":
      return def.options?.find((o) => o.id === v)?.name ?? "";
    case "multiselect":
      return (v as string[])
        .map((id) => def.options?.find((o) => o.id === id)?.name)
        .filter(Boolean)
        .join(", ");
    case "checkbox":
      return v ? "✓" : "";
    case "date":
      return formatDateValue(String(v));
    default:
      return String(v);
  }
}

export function formatDateValue(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
