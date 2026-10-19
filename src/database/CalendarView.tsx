import { useState } from "react";
import type { DbView, Page } from "../db/types";
import { navigate } from "../lib/store";
import { pageTitle } from "../components/ui";
import { createRowForView, setRowProp, updateView } from "./actions";
import { toIsoDate } from "./query";

function monthLabel(d: Date) {
  const m = d.toLocaleDateString("pt-BR", { month: "long" });
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${d.getFullYear()}`;
}

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function CalendarView({ dbPage, view, rows }: { dbPage: Page; view: DbView; rows: Page[] }) {
  const schema = dbPage.dbSchema ?? [];
  const dateDef = schema.find((d) => d.id === view.dateProp && d.type === "date");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [over, setOver] = useState<string | null>(null);

  if (!dateDef) {
    const candidates = schema.filter((d) => d.type === "date");
    return (
      <div className="embed-placeholder" style={{ marginTop: 8 }}>
        Mostrar no calendário pela data:
        {candidates.map((c) => (
          <button key={c.id} className="btn" onClick={() => updateView(dbPage.id, view.id, { dateProp: c.id })}>
            {c.name}
          </button>
        ))}
        {!candidates.length && <span className="faint">crie uma propriedade do tipo Data na visão Tabela.</span>}
      </div>
    );
  }

  const start = new Date(month);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  // Esconde a última semana se ela for toda do mês seguinte.
  const visibleDays = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
  const today = toIsoDate(new Date());

  const byDay = new Map<string, Page[]>();
  const undated: Page[] = [];
  for (const r of rows) {
    const v = r.properties?.[dateDef.id];
    if (typeof v === "string" && v) {
      const k = v.slice(0, 10);
      byDay.set(k, [...(byDay.get(k) ?? []), r]);
    } else undated.push(r);
  }

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div>
      <div className="calendar-head">
        <span className="m">{monthLabel(month)}</span>
        <button className="topbar-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
          ‹
        </button>
        <button
          className="topbar-btn"
          onClick={() => {
            const d = new Date();
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
        >
          Hoje
        </button>
        <button className="topbar-btn" onClick={() => shift(1)} aria-label="Próximo mês">
          ›
        </button>
      </div>
      <div className="calendar">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {visibleDays.map((d) => {
          const iso = toIsoDate(d);
          const items = byDay.get(iso) ?? [];
          return (
            <div
              key={iso}
              className={`cal-day${d.getMonth() !== month.getMonth() ? " other" : ""}${iso === today ? " today" : ""}`}
              style={over === iso ? { background: "var(--bg-active)" } : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(iso);
              }}
              onDragLeave={() => setOver((o) => (o === iso ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("application/x-atrium-row");
                if (id) setRowProp(id, dateDef.id, iso);
              }}
            >
              <button className="icon-btn add" title="Novo item neste dia" onClick={() => createRowForView(dbPage, view, { [dateDef.id]: iso })}>
                ＋
              </button>
              <div className="n">
                <span>{d.getDate()}</span>
              </div>
              {items.map((r) => (
                <div
                  key={r.id}
                  className="cal-event"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("application/x-atrium-row", r.id)}
                  onClick={() => navigate(r.id)}
                  title={pageTitle(r)}
                >
                  {r.icon} {pageTitle(r)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="faint" style={{ marginBottom: 4 }}>
            Sem data ({undated.length}) — arraste para um dia:
          </div>
          <div className="row">
            {undated.map((r) => (
              <div
                key={r.id}
                className="cal-event"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-atrium-row", r.id)}
                onClick={() => navigate(r.id)}
              >
                {r.icon} {pageTitle(r)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
