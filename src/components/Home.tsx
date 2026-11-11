import { useLiveQuery } from "dexie-react-hooks";
import type { Profile } from "../db/types";
import { db } from "../db/schema";
import { createPage } from "../db/repo";
import { openModal } from "../lib/store";
import { BUILTIN_TEMPLATES, createFromBuiltin } from "../templates/builtin";
import { openPage } from "./PageTree";
import { pageTitle, timeAgo } from "./ui";
import { Database, FileText, LayoutTemplate, Plus } from "./icons";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Home({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    async () => {
      const pages = await db.pages
        .where("profileId")
        .equals(profile.id)
        .filter((p) => !p.deleted && p.trashedAt === null && !p.isTemplate)
        .toArray();
      const byId = new Map(pages.map((p) => [p.id, p]));
      return pages
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 15)
        .map((p) => ({ page: p, parent: p.parentId ? byId.get(p.parentId) : undefined }));
    },
    [profile.id],
    [],
  );

  return (
    <div className="home">
      <h1>{greeting()}!</h1>
      <div className="muted">
        Você está no perfil <b>{profile.icon} {profile.name}</b>.
      </div>

      <div className="home-grid">
        <button
          className="home-card"
          onClick={async () => {
            const p = await createPage({ profileId: profile.id });
            openPage(p.id);
          }}
        >
          <div className="big">
            <Plus />
          </div>
          <div className="t">Nova página</div>
          <div className="s">Página em branco</div>
        </button>
        {BUILTIN_TEMPLATES.slice(0, 2).map((t) => (
          <button
            key={t.id}
            className="home-card"
            onClick={async () => {
              const p = await createFromBuiltin(t, profile.id, null);
              openPage(p.id);
            }}
          >
            <div className="big">{t.icon}</div>
            <div className="t">{t.name}</div>
            <div className="s">Template</div>
          </button>
        ))}
        <button className="home-card" onClick={() => openModal("templates")}>
          <div className="big">
            <LayoutTemplate />
          </div>
          <div className="t">Mais templates</div>
          <div className="s">Reunião, projeto, tarefas…</div>
        </button>
      </div>

      {recent.length > 0 && (
        <>
          <h3 style={{ marginTop: 36, fontSize: 14, color: "var(--text-muted)" }}>Editadas recentemente</h3>
          <div className="recent-list">
            {recent.map(({ page: p, parent }) => (
              <button key={p.id} className="recent-row" onClick={() => openPage(p.id)} title={new Date(p.updatedAt).toLocaleString("pt-BR")}>
                <span className="icon">{p.icon || (p.kind === "database" ? <Database /> : <FileText />)}</span>
                <span className="title">{pageTitle(p)}</span>
                {parent && <span className="where">em {parent.icon ? `${parent.icon} ` : ""}{pageTitle(parent)}</span>}
                <span className="when">{timeAgo(p.updatedAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
