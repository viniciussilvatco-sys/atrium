import { useEffect, useState } from "react";
import type { Page } from "../db/types";
import { usePage, useTemplates } from "../db/hooks";
import { deletePageForever, restorePage, updatePage, defaultDatabaseSchema } from "../db/repo";
import { remoteChanges } from "../sync/syncEngine";
import { navigate, openModal } from "../lib/store";
import { PageEditor } from "../editor/Editor";
import { DatabaseView } from "../database/DatabaseView";
import { PropertiesPanel } from "../database/PropertiesPanel";
import { BUILTIN_TEMPLATES, applyBuiltinToPage, applyUserTemplateToPage } from "../templates/builtin";
import { PageHeader } from "./PageHeader";
import { confirmAction } from "./ui";

export function isEmptyContent(content: unknown[]): boolean {
  if (!content || content.length === 0) return true;
  if (content.length > 1) return false;
  const b = content[0] as { type: string; content?: unknown[]; children?: unknown[] };
  return b.type === "paragraph" && (!b.content || b.content.length === 0) && (!b.children || b.children.length === 0);
}

function Starter({ page, onDismiss, onApplied }: { page: Page; onDismiss: () => void; onApplied: () => void }) {
  const run = (fn: () => Promise<unknown>) => () => void fn().then(onApplied);
  const userTemplates = useTemplates(page.profileId) ?? [];
  const builtinPages = BUILTIN_TEMPLATES.filter((t) => t.kind === "page").slice(0, 4);
  const builtinDbs = BUILTIN_TEMPLATES.filter((t) => t.kind === "database");
  return (
    <div className="starter">
      <div className="starter-title">Pressione Enter para continuar com uma página vazia, ou comece com:</div>
      <button onClick={onDismiss}>📄 Página vazia</button>
      {builtinPages.map((t) => (
        <button key={t.id} onClick={run(() => applyBuiltinToPage(t, page))}>
          {t.icon} {t.name}
        </button>
      ))}
      {userTemplates.map((t) => (
        <button key={t.id} onClick={run(() => applyUserTemplateToPage(t.id, page))}>
          {t.icon || "🧩"} {t.title || "Template sem título"} <span className="faint">(seu template)</span>
        </button>
      ))}
      <button onClick={() => updatePage(page.id, { kind: "database", icon: page.icon || "🗂️", ...defaultDatabaseSchema() })}>
        🗂️ Banco de dados vazio
      </button>
      {builtinDbs.map((t) => (
        <button key={t.id} onClick={run(() => applyBuiltinToPage(t, page))}>
          {t.icon} {t.name}
        </button>
      ))}
      <button onClick={() => openModal("templates")}>🧩 Ver todos os templates…</button>
    </div>
  );
}

export function PageView({ pageId }: { pageId: string }) {
  const page = usePage(pageId);
  const [version, setVersion] = useState(0);
  const [starterDismissed, setStarterDismissed] = useState(false);

  // Se esta página foi alterada em outro dispositivo, recarrega o editor com a versão nova.
  useEffect(
    () =>
      remoteChanges.on(({ pages }) => {
        if (pages.includes(pageId)) setVersion((v) => v + 1);
      }),
    [pageId],
  );
  useEffect(() => setStarterDismissed(false), [pageId]);

  if (page === undefined) return <div className="page faint" style={{ paddingTop: 60 }} />;
  if (!page || page.deleted)
    return (
      <div className="home">
        <h1>Página não encontrada</h1>
        <p className="muted">Ela pode ter sido excluída ou ainda não chegou da sincronização.</p>
        <button className="btn" onClick={() => navigate(null)}>
          Voltar ao início
        </button>
      </div>
    );

  const trashed = page.trashedAt !== null;
  const editable = !trashed;
  const showStarter = editable && page.kind === "page" && !starterDismissed && isEmptyContent(page.content);

  return (
    <div>
      {trashed && (
        <div className="banner" style={{ background: "var(--tag-red)" }}>
          Esta página está na lixeira.
          <button className="btn" onClick={() => restorePage(page.id)}>
            Restaurar
          </button>
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirmAction("Excluir definitivamente esta página e suas subpáginas?")) return;
              await deletePageForever(page.id);
              navigate(null);
            }}
          >
            Excluir definitivamente
          </button>
        </div>
      )}
      {page.isTemplate && <div className="banner">🧩 Você está editando um template. Novas páginas criadas a partir dele terão este conteúdo.</div>}
      {!!page.conflicts?.length && (
        <div className="banner">
          ⚠️ Esta página foi editada em dois aparelhos ao mesmo tempo. A versão mais recente foi mantida.
          <button className="btn" onClick={() => openModal("conflicts")}>
            Ver outras versões ({page.conflicts.length})
          </button>
        </div>
      )}
      <PageHeader page={page} editable={editable} onTitleEnter={() => setStarterDismissed(true)} />
      <div
        className={`page${page.fullWidth || page.kind === "database" ? " full-width" : ""}`}
        style={page.kind === "database" ? undefined : { paddingBottom: 0 }}
      >
        {page.kind === "row" && <PropertiesPanel row={page} />}
        {page.kind === "database" ? (
          <DatabaseView databaseId={page.id} />
        ) : (
          <div className="editor-wrap">
            <PageEditor key={`${page.id}:${page.kind}`} page={page} editable={editable} reloadToken={version}>
              {showStarter && <Starter page={page} onDismiss={() => setStarterDismissed(true)} onApplied={() => setVersion((v) => v + 1)} />}
            </PageEditor>
          </div>
        )}
      </div>
    </div>
  );
}

