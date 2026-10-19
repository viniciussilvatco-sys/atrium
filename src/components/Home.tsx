import { useLiveQuery } from "dexie-react-hooks";
import type { Profile } from "../db/types";
import { db } from "../db/schema";
import { createPage } from "../db/repo";
import { openModal } from "../lib/store";
import { BUILTIN_TEMPLATES, createFromBuiltin } from "../templates/builtin";
import { openPage } from "./PageTree";
import { pageTitle, timeAgo } from "./ui";

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
      return pages.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
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
          <div className="big">＋</div>
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
          <div className="big">🧩</div>
          <div className="t">Mais templates</div>
          <div className="s">Reunião, projeto, tarefas…</div>
        </button>
      </div>

      {recent.length > 0 && (
        <>
          <h3 style={{ marginTop: 36, fontSize: 14, color: "var(--text-muted)" }}>Editadas recentemente</h3>
          <div className="home-grid">
            {recent.map((p) => (
              <button key={p.id} className="home-card" onClick={() => openPage(p.id)}>
                <div className="big">{p.icon || (p.kind === "database" ? "🗂️" : "📄")}</div>
                <div className="t">{pageTitle(p)}</div>
                <div className="s">{timeAgo(p.updatedAt)}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
