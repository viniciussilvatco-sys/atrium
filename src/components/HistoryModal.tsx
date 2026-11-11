import { useState } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import { usePage } from "../db/hooks";
import { restoreVersion } from "../db/repo";
import type { PageVersion } from "../db/types";
import { remoteChanges } from "../sync/syncEngine";
import { VersionPreview } from "../editor/VersionPreview";
import { Modal, confirmAction, pageTitle, toast } from "./ui";
import { History } from "./icons";

const REASONS: Record<PageVersion["reason"], string | null> = {
  auto: null,
  remote: "antes da sincronização",
  restore: "antes de restaurar",
};

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

const time = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function HistoryModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const page = usePage(pageId);
  const versions = useLiveQuery(
    () => db.versions.where("[pageId+at]").between([pageId, Dexie.minKey], [pageId, Dexie.maxKey]).reverse().toArray(),
    [pageId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!page || !versions) return null;
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];

  const restore = async () => {
    if (!selected) return;
    if (!confirmAction(`Voltar a página para a versão de ${dayLabel(selected.at).toLowerCase()} às ${time(selected.at)}?\n\nO conteúdo atual fica guardado no histórico, então dá para desfazer.`)) return;
    await restoreVersion(selected.id);
    // Recarrega o editor aberto com o conteúdo restaurado.
    remoteChanges.emit({ pages: [page.id] });
    toast("Versão restaurada");
    onClose();
  };

  let lastDay = "";
  return (
    <Modal title={`Histórico de versões — ${pageTitle(page)}`} onClose={onClose} wide>
      {!versions.length ? (
        <div className="history-empty">
          <History />
          <p>Ainda não há versões anteriores desta página.</p>
          <p className="faint">
            Enquanto você edita, o Atrium guarda uma cópia da página a cada 10 minutos, neste aparelho. Elas são mantidas por 30 dias (uma por dia
            depois dos 2 primeiros).
          </p>
        </div>
      ) : (
        <div className="history">
          <div className="history-list">
            {versions.map((v) => {
              const day = dayLabel(v.at);
              const header = day !== lastDay ? <div className="history-day">{day}</div> : null;
              lastDay = day;
              return (
                <div key={v.id}>
                  {header}
                  <button className={`history-item${v.id === selected?.id ? " active" : ""}`} onClick={() => setSelectedId(v.id)}>
                    <span>{time(v.at)}</span>
                    {REASONS[v.reason] && <span className="faint">{REASONS[v.reason]}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          {selected && (
            <div className="history-preview">
              <div className="history-preview-head">
                <span className="faint">
                  {dayLabel(selected.at)}, {time(selected.at)}
                </span>
                <button className="btn primary" onClick={restore}>
                  Restaurar esta versão
                </button>
              </div>
              <h1 className="history-title">
                {selected.icon ? `${selected.icon} ` : ""}
                {pageTitle(selected)}
              </h1>
              <VersionPreview key={selected.id} content={selected.content} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
