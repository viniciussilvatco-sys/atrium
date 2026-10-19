import type { Page, Profile } from "../db/types";
import { usePage, useTemplates, useTrash } from "../db/hooks";
import { deletePageForever, emptyTrash, restorePage, trashPage, updatePage, TRASH_RETENTION_DAYS } from "../db/repo";
import { blocksToText } from "../lib/blocks";
import { navigate } from "../lib/store";
import { BUILTIN_TEMPLATES, createFromBuiltin, createFromUserTemplate } from "../templates/builtin";
import { remoteChanges } from "../sync/syncEngine";
import { openPage } from "./PageTree";
import { Modal, confirmAction, formatDate, pageTitle, timeAgo, toast } from "./ui";

export function TrashModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const items = useTrash(profile.id) ?? [];
  return (
    <Modal title={`Lixeira — ${profile.name}`} onClose={onClose}>
      <p className="faint" style={{ marginTop: 0 }}>
        Páginas na lixeira são excluídas automaticamente após {TRASH_RETENTION_DAYS} dias.
      </p>
      {!items.length && <div className="faint" style={{ padding: 12, textAlign: "center" }}>A lixeira está vazia.</div>}
      {items.map((p) => (
        <div key={p.id} className="list-row">
          <span>{p.icon || "📄"}</span>
          <span className="grow" style={{ cursor: "pointer" }} onClick={() => (openPage(p.id), onClose())}>
            {pageTitle(p)} <span className="faint">· excluída {timeAgo(p.trashedAt!)}</span>
          </span>
          <button className="btn" onClick={() => restorePage(p.id)}>
            Restaurar
          </button>
          <button
            className="icon-btn"
            title="Excluir definitivamente"
            onClick={() => confirmAction(`Excluir "${pageTitle(p)}" definitivamente?`) && deletePageForever(p.id)}
          >
            🗑
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn danger" onClick={() => confirmAction("Esvaziar a lixeira? Isso não pode ser desfeito.") && emptyTrash(profile.id)}>
            Esvaziar lixeira
          </button>
        </div>
      )}
    </Modal>
  );
}

export function TemplatesModal({ profile, onClose, parentId }: { profile: Profile; onClose: () => void; parentId?: string | null }) {
  const userTemplates = useTemplates(profile.id) ?? [];
  const done = (p: Page | undefined) => {
    onClose();
    if (p) openPage(p.id);
  };
  return (
    <Modal title="Templates" onClose={onClose} wide>
      <p className="faint" style={{ marginTop: 0 }}>
        Clique em um template para criar uma nova página no perfil <b>{profile.name}</b>. Para criar seus próprios templates, abra uma página e use
        o menu ⋯ → “Salvar como template”.
      </p>
      {userTemplates.length > 0 && (
        <>
          <h3 style={{ fontSize: 14 }}>Seus templates</h3>
          <div className="template-grid" style={{ marginBottom: 18 }}>
            {userTemplates.map((t) => (
              <div key={t.id} className="template-card" role="button" style={{ cursor: "pointer" }} onClick={async () => done(await createFromUserTemplate(t.id, profile.id, parentId ?? null))}>
                <span className="big">{t.icon || "🧩"}</span>
                <b>{pageTitle(t)}</b>
                <span className="d">{blocksToText(t.content).slice(0, 90) || "Template personalizado"}</span>
                <div className="row" style={{ marginTop: 4 }}>
                  <button
                    className="btn"
                    style={{ padding: "2px 8px", fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      navigate(t.id);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="btn danger"
                    style={{ padding: "2px 8px", fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmAction(`Excluir o template "${pageTitle(t)}"?`)) trashPage(t.id);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h3 style={{ fontSize: 14 }}>Templates do Atrium</h3>
      <div className="template-grid">
        {BUILTIN_TEMPLATES.map((t) => (
          <button key={t.id} className="template-card" onClick={async () => done(await createFromBuiltin(t, profile.id, parentId ?? null))}>
            <span className="big">{t.icon}</span>
            <b>{t.name}</b>
            <span className="d">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ConflictsModal({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const page = usePage(pageId);
  if (!page) return null;
  const conflicts = page.conflicts ?? [];

  const restore = async (idx: number) => {
    const c = conflicts[idx];
    if (!confirmAction("Restaurar esta versão? A versão atual será guardada aqui no histórico.")) return;
    const current = { at: page.updatedAt, deviceId: page.deviceId, title: page.title, content: page.content };
    await updatePage(page.id, {
      title: c.title,
      content: c.content,
      conflicts: [current, ...conflicts.filter((_, i) => i !== idx)],
    });
    toast("Versão restaurada");
    onClose();
    // Recarrega o editor para mostrar o conteúdo restaurado.
    remoteChanges.emit({ pages: [page.id] });
  };

  return (
    <Modal title="Versões em conflito" onClose={onClose} wide>
      <p className="faint" style={{ marginTop: 0 }}>
        Quando a mesma página é editada em dois aparelhos antes de sincronizar, o Atrium mantém a versão mais recente e guarda a outra aqui.
      </p>
      {conflicts.map((c, i) => (
        <div key={`${c.at}-${c.deviceId}`} className="conflict-item">
          <div className="row">
            <b>{c.title || "Sem título"}</b>
            <span className="faint">editada em {formatDate(c.at)}</span>
          </div>
          <div className="conflict-preview">{blocksToText(c.content) || "(vazia)"}</div>
          <div className="row">
            <button className="btn" onClick={() => restore(i)}>
              Restaurar esta versão
            </button>
            <button className="btn" onClick={() => updatePage(page.id, { conflicts: conflicts.filter((_, j) => j !== i) })}>
              Descartar
            </button>
          </div>
        </div>
      ))}
      {!conflicts.length && <div className="faint">Nenhuma versão em conflito.</div>}
    </Modal>
  );
}
