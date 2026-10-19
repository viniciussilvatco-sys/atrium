import { useEffect, useMemo, useState } from "react";
import MiniSearch from "minisearch";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import type { Page, Profile } from "../db/types";
import { currentProfileStore } from "../lib/store";
import { openPage } from "./PageTree";
import { Modal, pageTitle } from "./ui";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function snippet(text: string, terms: string[]): React.ReactNode {
  if (!text) return null;
  const norm = normalize(text);
  let pos = -1;
  let len = 0;
  for (const t of terms) {
    const i = norm.indexOf(normalize(t));
    if (i >= 0 && (pos < 0 || i < pos)) {
      pos = i;
      len = t.length;
    }
  }
  if (pos < 0) return text.slice(0, 140);
  const start = Math.max(0, pos - 50);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, pos)}
      <mark>{text.slice(pos, pos + len)}</mark>
      {text.slice(pos + len, pos + len + 100)}
    </>
  );
}

export function SearchPalette({ onClose, profiles }: { onClose: () => void; profiles: Profile[] }) {
  const [query, setQuery] = useState("");
  const [allProfiles, setAllProfiles] = useState(false);
  const [selected, setSelected] = useState(0);
  const profileId = currentProfileStore.get();
  const pages = useLiveQuery(() => db.pages.filter((p) => !p.deleted && p.trashedAt === null && !p.isTemplate).toArray(), [], [] as Page[]);

  const scoped = useMemo(() => pages.filter((p) => allProfiles || p.profileId === profileId), [pages, allProfiles, profileId]);

  const index = useMemo(() => {
    const ms = new MiniSearch<Page>({
      fields: ["title", "text"],
      storeFields: ["id"],
      processTerm: (t) => normalize(t),
      searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    ms.addAll(scoped);
    return ms;
  }, [scoped]);

  const byId = useMemo(() => new Map(scoped.map((p) => [p.id, p])), [scoped]);
  const results = useMemo(() => {
    if (!query.trim()) return [...scoped].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12).map((p) => ({ page: p, terms: [] as string[] }));
    return index
      .search(query)
      .slice(0, 30)
      .map((r) => ({ page: byId.get(r.id as string)!, terms: r.terms }))
      .filter((r) => r.page);
  }, [query, index, byId, scoped]);

  useEffect(() => setSelected(0), [query, allProfiles]);

  const go = (p: Page) => {
    if (p.profileId !== profileId) currentProfileStore.set(p.profileId);
    openPage(p.id);
    onClose();
  };

  const profileOf = (id: string) => profiles.find((p) => p.id === id);

  return (
    <Modal onClose={onClose} bare>
      <input
        className="search-input"
        autoFocus
        placeholder="Buscar páginas…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((s) => Math.min(results.length - 1, s + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((s) => Math.max(0, s - 1));
          } else if (e.key === "Enter" && results[selected]) go(results[selected].page);
        }}
      />
      <div className="row" style={{ padding: "6px 14px", borderBottom: "1px solid var(--border)" }}>
        <label className="faint" style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={allProfiles} onChange={(e) => setAllProfiles(e.target.checked)} />
          Buscar em todos os perfis
        </label>
        <span className="faint" style={{ marginLeft: "auto" }}>
          {query ? `${results.length} resultado(s)` : "Recentes"}
        </span>
      </div>
      <div className="search-results">
        {results.map(({ page, terms }, i) => {
          const prof = profileOf(page.profileId);
          return (
            <div key={page.id} className={`search-result${i === selected ? " selected" : ""}`} onMouseEnter={() => setSelected(i)} onClick={() => go(page)}>
              <span style={{ fontSize: 18 }}>{page.icon || (page.kind === "database" ? "🗂️" : "📄")}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="sr-title">
                  {pageTitle(page)}
                  {allProfiles && prof && <span className="faint"> · {prof.icon} {prof.name}</span>}
                </div>
                {terms.length > 0 && <div className="sr-snippet">{snippet(page.text, terms)}</div>}
              </div>
            </div>
          );
        })}
        {!results.length && <div className="faint" style={{ padding: 16 }}>Nada encontrado.</div>}
      </div>
    </Modal>
  );
}
