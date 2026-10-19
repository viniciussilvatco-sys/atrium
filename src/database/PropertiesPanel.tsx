import { useState } from "react";
import type { Page, PropDef } from "../db/types";
import { usePage } from "../db/hooks";
import { PropertyCell } from "./PropertyCell";
import { PropertyMenu, PropTypePicker } from "./PropertyMenu";
import { addProperty } from "./actions";
import { PROP_TYPE_LABELS } from "./query";
import type { Anchor } from "../components/ui";

/** Propriedades de uma linha de banco de dados, mostradas no topo da página da linha. */
export function PropertiesPanel({ row }: { row: Page }) {
  const dbPage = usePage(row.parentId);
  const [menu, setMenu] = useState<{ def: PropDef; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  if (!dbPage || dbPage.kind !== "database") return null;
  const schema = dbPage.dbSchema ?? [];
  const view = dbPage.views?.[0] ?? { id: "", name: "", type: "table" as const, filters: [], sorts: [] };

  return (
    <div className="props-panel">
      {schema.map((d) => (
        <div key={d.id} className="prop-row">
          <button className="prop-name th-btn" style={{ width: 160, minHeight: 0 }} onClick={(e) => setMenu({ def: d, anchor: e.currentTarget })}>
            <span>{PROP_TYPE_LABELS[d.type].icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          </button>
          <div className="prop-value">
            <PropertyCell dbId={dbPage.id} def={d} row={row} compact />
          </div>
        </div>
      ))}
      <button className="ghost-btn" onClick={(e) => setAddAnchor(e.currentTarget)}>
        ＋ Adicionar propriedade
      </button>
      {menu && <PropertyMenu dbPage={dbPage} def={menu.def} view={view} anchor={menu.anchor} onClose={() => setMenu(null)} />}
      {addAnchor && <PropTypePicker anchor={addAnchor} onClose={() => setAddAnchor(null)} onPick={(t) => addProperty(dbPage.id, t)} />}
    </div>
  );
}
