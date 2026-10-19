import type { DbView, Page } from "../db/types";
import { navigate } from "../lib/store";
import { pageTitle } from "../components/ui";
import { Tag } from "./PropertyCell";
import { formatValue } from "./query";

export function ListView({ dbPage, view, rows, onAdd }: { dbPage: Page; view: DbView; rows: Page[]; onAdd: () => void }) {
  const props = (dbPage.dbSchema ?? []).filter((d) => !view.hiddenProps?.includes(d.id));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => navigate(r.id)}>
          <span>{r.icon || "📄"}</span>
          <span className="grow" style={{ fontWeight: 500 }}>
            {pageTitle(r)}
          </span>
          <span className="row" style={{ gap: 4, flexWrap: "nowrap", overflow: "hidden" }}>
            {props.map((d) => {
              const v = r.properties?.[d.id];
              if (d.type === "select" || d.type === "status" || d.type === "multiselect") {
                const ids = Array.isArray(v) ? (v as string[]) : v ? [v as string] : [];
                return ids.map((id) => {
                  const o = d.options?.find((x) => x.id === id);
                  return o ? <Tag key={d.id + id} option={o} /> : null;
                });
              }
              const text = formatValue(v, d);
              return text ? (
                <span key={d.id} className="faint">
                  {text}
                </span>
              ) : null;
            })}
          </span>
        </div>
      ))}
      <button className="add-row" style={{ border: "none" }} onClick={onAdd}>
        ＋ Novo
      </button>
    </div>
  );
}
