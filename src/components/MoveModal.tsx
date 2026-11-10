// Janela "Mover para…": escolhe o perfil e a página onde a página vai ficar (ou o primeiro nível).

import { useEffect, useMemo, useState } from "react";
import type { Page, Profile } from "../db/types";
import { usePage, useTreePages } from "../db/hooks";
import { getDescendants, movePage } from "../db/repo";
import { Modal, pageTitle, toast } from "./ui";

export function MoveModal({ pageId, profiles, onClose }: { pageId: string; profiles: Profile[]; onClose: () => void }) {
  const page = usePage(pageId);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const targetProfile = profileId ?? page?.profileId ?? null;
  const pages = useTreePages(targetProfile);

  // A página não pode ir para dentro dela mesma nem de uma das suas subpáginas.
  useEffect(() => {
    getDescendants(pageId).then((d) => setBlocked(new Set([pageId, ...d.map((x) => x.id)])));
  }, [pageId]);

  // Lista em árvore (com recuo), já sem as páginas proibidas e sem bancos de dados.
  const list = useMemo(() => {
    const all = (pages ?? []).filter((p) => !blocked.has(p.id) && p.kind === "page");
    const ids = new Set(all.map((p) => p.id));
    const kids = new Map<string | null, Page[]>();
    for (const p of all) {
      const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
      kids.set(key, [...(kids.get(key) ?? []), p]);
    }
    const out: { page: Page; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const p of kids.get(parent) ?? []) {
        out.push({ page: p, depth });
        walk(p.id, depth + 1);
      }
    };
    walk(null, 0);
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? out.filter((x) => pageTitle(x.page).toLocaleLowerCase("pt-BR").includes(q)).map((x) => ({ ...x, depth: 0 })) : out;
  }, [pages, blocked, query]);

  if (!page) return null;

  const moveTo = async (parent: Page | null) => {
    if (!targetProfile) return;
    await movePage(page.id, { parentId: parent?.id ?? null, order: Date.now(), profileId: targetProfile });
    const prof = profiles.find((p) => p.id === targetProfile);
    toast(parent ? `Movida para dentro de “${pageTitle(parent)}”` : `Movida para o perfil ${prof?.name ?? ""}`);
    onClose();
  };

  return (
    <Modal title={`Mover “${pageTitle(page)}”`} onClose={onClose}>
      {profiles.length > 1 && (
        <>
          <div className="faint" style={{ marginBottom: 6 }}>Perfil</div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {profiles.map((p) => (
              <button key={p.id} className={`btn${p.id === targetProfile ? " primary" : ""}`} onClick={() => setProfileId(p.id)}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </>
      )}
      <input className="input" placeholder="Procurar página de destino…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
        <div className="list-row" style={{ cursor: "pointer" }} onClick={() => moveTo(null)}>
          <span>⬆️</span>
          <span className="grow">
            <b>Primeiro nível</b> <span className="faint">(direto na barra lateral)</span>
          </span>
        </div>
        {list.map(({ page: p, depth }) => (
          <div
            key={p.id}
            className="list-row"
            style={{ cursor: "pointer", paddingLeft: 8 + depth * 16, fontWeight: p.id === page.parentId ? 600 : undefined }}
            onClick={() => moveTo(p)}
          >
            <span>{p.icon || "📄"}</span>
            <span className="grow">
              {pageTitle(p)}
              {p.id === page.parentId && <span className="faint"> · local atual</span>}
            </span>
          </div>
        ))}
        {!list.length && <div className="faint" style={{ padding: 12, textAlign: "center" }}>Nenhuma página encontrada.</div>}
      </div>
    </Modal>
  );
}
