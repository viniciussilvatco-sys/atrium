import { useState } from "react";
import type { DbFilter, DbView, Page, ViewType } from "../db/types";
import { usePage, useRows } from "../db/hooks";
import { updatePage } from "../db/repo";
import { newId } from "../lib/ids";
import { navigate, createPersistedStore } from "../lib/store";
import { Menu, Popover, confirmAction, type Anchor } from "../components/ui";
import { addView, createRowForView, deleteView, updateView, VIEW_LABELS } from "./actions";
import { applyView, FILTER_OP_LABELS, FILTER_OPS, OPS_WITHOUT_VALUE, propTypeOf } from "./query";
import { TableView } from "./TableView";
import { BoardView } from "./BoardView";
import { CalendarView } from "./CalendarView";
import { ListView } from "./ListView";

const activeViews = createPersistedStore<Record<string, string>>("atrium.activeViews", {});

function propLabel(dbPage: Page, propId: string) {
  return propId === "title" ? "Nome" : (dbPage.dbSchema?.find((d) => d.id === propId)?.name ?? "?");
}

function FilterValueInput({ dbPage, filter, onChange }: { dbPage: Page; filter: DbFilter; onChange: (v: string) => void }) {
  const type = propTypeOf(filter.propId, dbPage.dbSchema ?? []);
  if (OPS_WITHOUT_VALUE.includes(filter.op)) return null;
  if (type === "select" || type === "status" || type === "multiselect") {
    const def = dbPage.dbSchema?.find((d) => d.id === filter.propId);
    return (
      <select className="input" value={filter.value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {def?.options?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="input"
      type={type === "date" ? "date" : type === "number" ? "number" : "text"}
      value={filter.value ?? ""}
      placeholder="Valor…"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FilterPanel({ dbPage, view, anchor, onClose }: { dbPage: Page; view: DbView; anchor: Anchor; onClose: () => void }) {
  const schema = dbPage.dbSchema ?? [];
  const props = [{ id: "title", name: "Nome" }, ...schema];
  const setFilters = (filters: DbFilter[]) => updateView(dbPage.id, view.id, { filters });
  return (
    <Popover anchor={anchor} onClose={onClose} width={440}>
      <div className="menu-label">Filtros</div>
      {!view.filters.length && <div className="faint" style={{ padding: "4px 8px" }}>Nenhum filtro nesta visão.</div>}
      {view.filters.map((f) => {
        const type = propTypeOf(f.propId, schema);
        const update = (patch: Partial<DbFilter>) => setFilters(view.filters.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
        return (
          <div key={f.id} className="row" style={{ padding: 4, flexWrap: "nowrap" }}>
            <select
              className="input"
              value={f.propId}
              onChange={(e) => {
                const t = propTypeOf(e.target.value, schema);
                update({ propId: e.target.value, op: FILTER_OPS[t][0], value: "" });
              }}
            >
              {props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="input" value={f.op} onChange={(e) => update({ op: e.target.value as DbFilter["op"] })}>
              {FILTER_OPS[type].map((op) => (
                <option key={op} value={op}>
                  {FILTER_OP_LABELS[op]}
                </option>
              ))}
            </select>
            <FilterValueInput dbPage={dbPage} filter={f} onChange={(value) => update({ value })} />
            <button className="icon-btn" onClick={() => setFilters(view.filters.filter((x) => x.id !== f.id))} title="Remover filtro">
              ✕
            </button>
          </div>
        );
      })}
      <button
        className="menu-item"
        onClick={() => setFilters([...view.filters, { id: newId(), propId: "title", op: "contains", value: "" }])}
      >
        <span className="mi-icon">＋</span> Adicionar filtro
      </button>
    </Popover>
  );
}

function SortPanel({ dbPage, view, anchor, onClose }: { dbPage: Page; view: DbView; anchor: Anchor; onClose: () => void }) {
  const props = [{ id: "title", name: "Nome" }, ...(dbPage.dbSchema ?? [])];
  const setSorts = (sorts: DbView["sorts"]) => updateView(dbPage.id, view.id, { sorts });
  return (
    <Popover anchor={anchor} onClose={onClose} width={340}>
      <div className="menu-label">Ordenação</div>
      {!view.sorts.length && <div className="faint" style={{ padding: "4px 8px" }}>Ordem manual (de criação).</div>}
      {view.sorts.map((s, i) => (
        <div key={i} className="row" style={{ padding: 4, flexWrap: "nowrap" }}>
          <select className="input" value={s.propId} onChange={(e) => setSorts(view.sorts.map((x, j) => (j === i ? { ...x, propId: e.target.value } : x)))}>
            {props.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={s.dir}
            onChange={(e) => setSorts(view.sorts.map((x, j) => (j === i ? { ...x, dir: e.target.value as "asc" | "desc" } : x)))}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
          <button className="icon-btn" onClick={() => setSorts(view.sorts.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="menu-item" onClick={() => setSorts([...view.sorts, { propId: "title", dir: "asc" }])}>
        <span className="mi-icon">＋</span> Adicionar ordenação
      </button>
    </Popover>
  );
}

function ViewSettings({ dbPage, view, anchor, onClose }: { dbPage: Page; view: DbView; anchor: Anchor; onClose: () => void }) {
  const [name, setName] = useState(view.name);
  const schema = dbPage.dbSchema ?? [];
  const hidden = view.hiddenProps ?? [];
  return (
    <Popover anchor={anchor} onClose={onClose} width={280}>
      <div className="menu-label">Nome da visão</div>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && updateView(dbPage.id, view.id, { name: name.trim() })}
      />
      <div className="menu-label">Tipo</div>
      <select
        className="input"
        value={view.type}
        onChange={(e) => {
          const type = e.target.value as ViewType;
          const patch: Partial<DbView> = { type };
          if (type === "board" && !view.groupBy) patch.groupBy = schema.find((d) => d.type === "status" || d.type === "select")?.id;
          if (type === "calendar" && !view.dateProp) patch.dateProp = schema.find((d) => d.type === "date")?.id;
          updateView(dbPage.id, view.id, patch);
        }}
      >
        {(Object.keys(VIEW_LABELS) as ViewType[]).map((t) => (
          <option key={t} value={t}>
            {VIEW_LABELS[t].label}
          </option>
        ))}
      </select>
      {view.type === "board" && (
        <>
          <div className="menu-label">Agrupar por</div>
          <select className="input" value={view.groupBy ?? ""} onChange={(e) => updateView(dbPage.id, view.id, { groupBy: e.target.value || undefined })}>
            <option value="">—</option>
            {schema
              .filter((d) => d.type === "status" || d.type === "select")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </>
      )}
      {view.type === "calendar" && (
        <>
          <div className="menu-label">Data usada no calendário</div>
          <select className="input" value={view.dateProp ?? ""} onChange={(e) => updateView(dbPage.id, view.id, { dateProp: e.target.value || undefined })}>
            <option value="">—</option>
            {schema
              .filter((d) => d.type === "date")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </>
      )}
      <div className="menu-label">Propriedades visíveis</div>
      {schema.map((d) => (
        <label key={d.id} className="menu-item" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!hidden.includes(d.id)}
            onChange={(e) =>
              updateView(dbPage.id, view.id, { hiddenProps: e.target.checked ? hidden.filter((h) => h !== d.id) : [...hidden, d.id] })
            }
          />
          {d.name}
        </label>
      ))}
      <div className="menu-sep" />
      <button
        className="menu-item danger"
        disabled={(dbPage.views?.length ?? 0) <= 1}
        onClick={() => {
          if (confirmAction(`Excluir a visão "${view.name}"?`)) deleteView(dbPage.id, view.id);
          onClose();
        }}
      >
        <span className="mi-icon">🗑</span> Excluir visão
      </button>
    </Popover>
  );
}

export function DatabaseView({ databaseId, inline }: { databaseId: string; inline?: boolean }) {
  const dbPage = usePage(databaseId);
  const rows = useRows(databaseId);
  const [active, setActive] = useState<string | undefined>(() => activeViews.get()[databaseId]);
  const [panel, setPanel] = useState<{ kind: "filter" | "sort" | "settings" | "add"; anchor: Anchor } | null>(null);

  if (dbPage === undefined) return <div className="faint">Carregando banco de dados…</div>;
  if (!dbPage || dbPage.deleted) return <div className="embed-placeholder">Este banco de dados foi excluído.</div>;
  if (dbPage.trashedAt !== null && inline) return <div className="embed-placeholder">🗑 Este banco de dados está na lixeira.</div>;

  const views = dbPage.views?.length ? dbPage.views : [{ id: "default", name: "Tabela", type: "table" as const, filters: [], sorts: [] }];
  const view = views.find((v) => v.id === active) ?? views[0];
  const visibleRows = rows ? applyView(rows, view, dbPage.dbSchema ?? []) : [];
  const select = (id: string) => {
    setActive(id);
    activeViews.set({ ...activeViews.get(), [databaseId]: id });
  };
  const add = () => createRowForView(dbPage, view);

  return (
    <div>
      {inline && (
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <span style={{ fontSize: 20 }}>{dbPage.icon}</span>
          <input
            className="db-title"
            defaultValue={dbPage.title}
            key={dbPage.title}
            placeholder="Sem título"
            onBlur={(e) => e.target.value !== dbPage.title && updatePage(dbPage.id, { title: e.target.value })}
          />
          <button className="topbar-btn" title="Abrir como página inteira" onClick={() => navigate(dbPage.id)}>
            ↗
          </button>
        </div>
      )}
      <div className="db-head">
        <div className="db-tabs">
          {views.map((v) => (
            <button
              key={v.id}
              className={`db-tab${v.id === view.id ? " on" : ""}`}
              onClick={(e) => (v.id === view.id ? setPanel({ kind: "settings", anchor: e.currentTarget }) : select(v.id))}
              title={v.id === view.id ? "Clique para configurar esta visão" : undefined}
            >
              <span>{VIEW_LABELS[v.type].icon}</span>
              {v.name}
            </button>
          ))}
          <button className="db-tab" title="Adicionar visão" onClick={(e) => setPanel({ kind: "add", anchor: e.currentTarget })}>
            ＋
          </button>
        </div>
        <div className="db-tools">
          <button
            className="topbar-btn"
            style={view.filters.length ? { color: "var(--accent)" } : undefined}
            onClick={(e) => setPanel({ kind: "filter", anchor: e.currentTarget })}
          >
            Filtrar{view.filters.length ? ` (${view.filters.length})` : ""}
          </button>
          <button
            className="topbar-btn"
            style={view.sorts.length ? { color: "var(--accent)" } : undefined}
            onClick={(e) => setPanel({ kind: "sort", anchor: e.currentTarget })}
          >
            Ordenar{view.sorts.length ? ` (${view.sorts.length})` : ""}
          </button>
          <button className="topbar-btn" title="Configurar visão" onClick={(e) => setPanel({ kind: "settings", anchor: e.currentTarget })}>
            ⚙
          </button>
          <button className="btn primary" style={{ padding: "3px 10px" }} onClick={add}>
            Novo
          </button>
        </div>
      </div>
      {view.filters.length > 0 && (
        <div className="db-filters">
          {view.filters.map((f) => (
            <span key={f.id} className="filter-chip" onClick={(e) => setPanel({ kind: "filter", anchor: e.currentTarget })} style={{ cursor: "pointer" }}>
              {propLabel(dbPage, f.propId)} {FILTER_OP_LABELS[f.op]}{" "}
              {f.value
                ? (dbPage.dbSchema?.find((d) => d.id === f.propId)?.options?.find((o) => o.id === f.value)?.name ?? f.value)
                : ""}
            </span>
          ))}
        </div>
      )}

      {rows === undefined ? (
        <div className="faint">Carregando…</div>
      ) : view.type === "board" ? (
        <BoardView dbPage={dbPage} view={view} rows={visibleRows} />
      ) : view.type === "calendar" ? (
        <CalendarView dbPage={dbPage} view={view} rows={visibleRows} />
      ) : view.type === "list" ? (
        <ListView dbPage={dbPage} view={view} rows={visibleRows} onAdd={add} />
      ) : (
        <TableView dbPage={dbPage} view={view} rows={visibleRows} onAdd={add} />
      )}

      {panel?.kind === "filter" && <FilterPanel dbPage={dbPage} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === "sort" && <SortPanel dbPage={dbPage} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === "settings" && <ViewSettings key={view.id} dbPage={dbPage} view={view} anchor={panel.anchor} onClose={() => setPanel(null)} />}
      {panel?.kind === "add" && (
        <Menu
          anchor={panel.anchor}
          onClose={() => setPanel(null)}
          items={[
            { heading: "Nova visão" },
            ...(Object.keys(VIEW_LABELS) as ViewType[]).map((t) => ({
              label: VIEW_LABELS[t].label,
              icon: VIEW_LABELS[t].icon,
              onClick: async () => select(await addView(dbPage.id, t)),
            })),
          ]}
        />
      )}
    </div>
  );
}
