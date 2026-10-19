import { useState } from "react";
import type { DbView, Page, PropDef, PropType } from "../db/types";
import { Popover, confirmAction, type Anchor } from "../components/ui";
import { changePropertyType, deleteProperty, updateProperty, updateView } from "./actions";
import { PROP_TYPE_LABELS } from "./query";

export const PROP_TYPES = Object.keys(PROP_TYPE_LABELS) as PropType[];

export function PropTypePicker({ anchor, onPick, onClose }: { anchor: Anchor; onPick: (t: PropType) => void; onClose: () => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={220}>
      <div className="menu-label">Tipo de propriedade</div>
      {PROP_TYPES.map((t) => (
        <button
          key={t}
          className="menu-item"
          onClick={() => {
            onClose();
            onPick(t);
          }}
        >
          <span className="mi-icon">{PROP_TYPE_LABELS[t].icon}</span>
          {PROP_TYPE_LABELS[t].label}
        </button>
      ))}
    </Popover>
  );
}

/** Menu do cabeçalho de coluna: renomear, tipo, ordenar, ocultar, excluir. */
export function PropertyMenu({
  dbPage,
  def,
  view,
  anchor,
  onClose,
}: {
  dbPage: Page;
  def: PropDef | null; // null = coluna de título
  view: DbView;
  anchor: Anchor;
  onClose: () => void;
}) {
  const [name, setName] = useState(def?.name ?? "");
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);
  const propId = def?.id ?? "title";

  const sortBy = (dir: "asc" | "desc") => {
    updateView(dbPage.id, view.id, { sorts: [{ propId, dir }, ...view.sorts.filter((s) => s.propId !== propId)] });
    onClose();
  };

  const saveName = () => {
    if (def && name.trim() && name !== def.name) updateProperty(dbPage.id, def.id, { name: name.trim() });
  };

  return (
    <Popover anchor={anchor} onClose={() => !typeAnchor && (saveName(), onClose())} width={240}>
      {def && (
        <>
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                saveName();
                onClose();
              }
            }}
          />
          <button className="menu-item" onClick={(e) => setTypeAnchor(e.currentTarget)}>
            <span className="mi-icon">{PROP_TYPE_LABELS[def.type].icon}</span>
            Tipo
            <span className="mi-hint">{PROP_TYPE_LABELS[def.type].label} ›</span>
          </button>
          <div className="menu-sep" />
        </>
      )}
      <button className="menu-item" onClick={() => sortBy("asc")}>
        <span className="mi-icon">↑</span> Ordenar crescente
      </button>
      <button className="menu-item" onClick={() => sortBy("desc")}>
        <span className="mi-icon">↓</span> Ordenar decrescente
      </button>
      {def && (
        <>
          <button
            className="menu-item"
            onClick={() => {
              updateView(dbPage.id, view.id, { hiddenProps: [...(view.hiddenProps ?? []), def.id] });
              onClose();
            }}
          >
            <span className="mi-icon">👁</span> Ocultar nesta visão
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item danger"
            onClick={() => {
              if (confirmAction(`Excluir a propriedade "${def.name}" e todos os seus valores?`)) deleteProperty(dbPage.id, def.id);
              onClose();
            }}
          >
            <span className="mi-icon">🗑</span> Excluir propriedade
          </button>
        </>
      )}
      {typeAnchor && def && (
        <PropTypePicker
          anchor={typeAnchor}
          onClose={() => setTypeAnchor(null)}
          onPick={(t) => {
            changePropertyType(dbPage.id, def.id, t);
            onClose();
          }}
        />
      )}
    </Popover>
  );
}
