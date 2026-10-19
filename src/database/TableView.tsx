import { useState } from "react";
import type { DbView, Page, PropDef } from "../db/types";
import { Menu, useMenu, type Anchor } from "../components/ui";
import { duplicatePage, trashPage, updatePage } from "../db/repo";
import { navigate } from "../lib/store";
import { PropertyCell } from "./PropertyCell";
import { PropertyMenu, PropTypePicker } from "./PropertyMenu";
import { addProperty } from "./actions";
import { PROP_TYPE_LABELS } from "./query";

function TitleCell({ row }: { row: Page }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <div className="cell title-cell">
        <input
          className="cell-input"
          autoFocus
          defaultValue={row.title}
          onBlur={(e) => {
            if (e.target.value !== row.title) updatePage(row.id, { title: e.target.value });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </div>
    );
  return (
    <div className="cell title-cell" onClick={() => setEditing(true)}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.icon && <span style={{ marginRight: 6 }}>{row.icon}</span>}
        {row.title || <span className="faint">Sem título</span>}
      </span>
      <button
        className="open-btn"
        onClick={(e) => {
          e.stopPropagation();
          navigate(row.id);
        }}
      >
        ABRIR
      </button>
    </div>
  );
}

function RowMenuButton({ row }: { row: Page }) {
  const menu = useMenu();
  return (
    <>
      <button className="icon-btn" onClick={menu.open} title="Opções da linha">
        ⋮
      </button>
      {menu.anchor && (
        <Menu
          anchor={menu.anchor}
          onClose={menu.close}
          items={[
            { label: "Abrir como página", icon: "↗", onClick: () => navigate(row.id) },
            { label: "Duplicar", icon: "⧉", onClick: () => duplicatePage(row.id) },
            { separator: true },
            { label: "Excluir", icon: "🗑", danger: true, onClick: () => trashPage(row.id) },
          ]}
        />
      )}
    </>
  );
}

export function TableView({
  dbPage,
  view,
  rows,
  onAdd,
}: {
  dbPage: Page;
  view: DbView;
  rows: Page[];
  onAdd: () => void;
}) {
  const schema = dbPage.dbSchema ?? [];
  const visible = schema.filter((d) => !view.hiddenProps?.includes(d.id));
  const [menu, setMenu] = useState<{ def: PropDef | null; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th style={{ width: 28, border: "none" }} />
              <th>
                <button className="th-btn" onClick={(e) => setMenu({ def: null, anchor: e.currentTarget })}>
                  <span>Aa</span> Nome
                </button>
              </th>
              {visible.map((d) => (
                <th key={d.id}>
                  <button className="th-btn" onClick={(e) => setMenu({ def: d, anchor: e.currentTarget })}>
                    <span>{PROP_TYPE_LABELS[d.type].icon}</span> {d.name}
                  </button>
                </th>
              ))}
              <th style={{ width: 40 }}>
                <button className="th-btn" title="Adicionar propriedade" onClick={(e) => setAddAnchor(e.currentTarget)}>
                  ＋
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ border: "none", width: 28 }}>
                  <RowMenuButton row={r} />
                </td>
                <td>
                  <TitleCell row={r} />
                </td>
                {visible.map((d) => (
                  <td key={d.id}>
                    <PropertyCell dbId={dbPage.id} def={d} row={r} />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="add-row" onClick={onAdd}>
        ＋ Novo
      </button>
      <div className="faint" style={{ padding: "6px 8px" }}>
        {rows.length} {rows.length === 1 ? "item" : "itens"}
      </div>
      {menu && <PropertyMenu dbPage={dbPage} def={menu.def} view={view} anchor={menu.anchor} onClose={() => setMenu(null)} />}
      {addAnchor && <PropTypePicker anchor={addAnchor} onClose={() => setAddAnchor(null)} onPick={(t) => addProperty(dbPage.id, t)} />}
    </>
  );
}
