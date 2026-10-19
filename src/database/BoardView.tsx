import { useState } from "react";
import type { DbView, Page } from "../db/types";
import { navigate } from "../lib/store";
import { pageTitle } from "../components/ui";
import { Tag } from "./PropertyCell";
import { addOption, createRowForView, setRowProp, updateView } from "./actions";
import { formatValue } from "./query";

function Card({ row, dbPage, view }: { row: Page; dbPage: Page; view: DbView }) {
  const props = (dbPage.dbSchema ?? []).filter((d) => d.id !== view.groupBy && !view.hiddenProps?.includes(d.id));
  return (
    <div
      className="card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-atrium-row", row.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => navigate(row.id)}
    >
      <div className="ct">
        {row.icon && <span style={{ marginRight: 4 }}>{row.icon}</span>}
        {pageTitle(row)}
      </div>
      <div className="card-props">
        {props.map((d) => {
          const v = row.properties?.[d.id];
          if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || v === false) return null;
          if (d.type === "select" || d.type === "status" || d.type === "multiselect") {
            const ids = Array.isArray(v) ? (v as string[]) : [v as string];
            return ids.map((id) => {
              const o = d.options?.find((x) => x.id === id);
              return o ? <Tag key={d.id + id} option={o} /> : null;
            });
          }
          return (
            <span key={d.id}>
              {d.type === "checkbox" ? `✓ ${d.name}` : formatValue(v, d)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BoardView({ dbPage, view, rows }: { dbPage: Page; view: DbView; rows: Page[] }) {
  const schema = dbPage.dbSchema ?? [];
  const groupDef = schema.find((d) => d.id === view.groupBy && (d.type === "select" || d.type === "status"));
  const [over, setOver] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState<string | null>(null);

  if (!groupDef) {
    const candidates = schema.filter((d) => d.type === "select" || d.type === "status");
    return (
      <div className="embed-placeholder" style={{ marginTop: 8 }}>
        Agrupar o quadro por:
        {candidates.map((c) => (
          <button key={c.id} className="btn" onClick={() => updateView(dbPage.id, view.id, { groupBy: c.id })}>
            {c.name}
          </button>
        ))}
        {!candidates.length && <span className="faint">crie uma propriedade do tipo Seleção ou Status na visão Tabela.</span>}
      </div>
    );
  }

  const columns = [...(groupDef.options ?? []).map((o) => ({ key: o.id, option: o })), { key: "__none", option: null }];

  const drop = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("application/x-atrium-row");
    if (id) setRowProp(id, groupDef.id, key === "__none" ? undefined : key);
  };

  return (
    <div className="board">
      {columns.map(({ key, option }) => {
        const items = rows.filter((r) => {
          const v = r.properties?.[groupDef.id] as string | undefined;
          return key === "__none" ? !v || !groupDef.options?.some((o) => o.id === v) : v === key;
        });
        if (key === "__none" && !items.length) return null;
        return (
          <div
            key={key}
            className={`board-col${over === key ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(key);
            }}
            onDragLeave={() => setOver((o) => (o === key ? null : o))}
            onDrop={(e) => drop(key, e)}
          >
            <div className="board-col-head">
              {option ? <Tag option={option} /> : <span>Sem {groupDef.name.toLowerCase()}</span>}
              <span className="faint">{items.length}</span>
            </div>
            {items.map((r) => (
              <Card key={r.id} row={r} dbPage={dbPage} view={view} />
            ))}
            <button
              className="add-row"
              style={{ border: "none", borderRadius: 6 }}
              onClick={() => createRowForView(dbPage, view, key === "__none" ? {} : { [groupDef.id]: key })}
            >
              ＋ Novo
            </button>
          </div>
        );
      })}
      <div className="board-col">
        {newGroup === null ? (
          <button className="add-row" style={{ border: "none" }} onClick={() => setNewGroup("")}>
            ＋ Novo grupo
          </button>
        ) : (
          <input
            className="input"
            autoFocus
            placeholder="Nome do grupo"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onBlur={() => setNewGroup(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newGroup.trim()) {
                addOption(dbPage.id, groupDef.id, newGroup.trim());
                setNewGroup(null);
              }
              if (e.key === "Escape") setNewGroup(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
