import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Profile } from "../db/types";
import { db } from "../db/schema";
import { useTreePages } from "../db/hooks";
import { createPage } from "../db/repo";
import { getSyncStatus, syncNow, syncStatus, type SyncStatus } from "../sync/syncEngine";
import { mobileSidebarStore, navigate, openModal, routeStore, sidebarStore, useStore } from "../lib/store";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { PageTree, openPage } from "./PageTree";
import { pageTitle, timeAgo } from "./ui";

const SYNC_LABELS: Record<SyncStatus["state"], string> = {
  disconnected: "Somente neste aparelho",
  idle: "Sincronizado",
  syncing: "Sincronizando…",
  pending: "Alterações pendentes",
  offline: "Sem internet (salvo localmente)",
  error: "Erro ao sincronizar",
  needsReauth: "Toque para reconectar ao Google",
};

export function useSyncStatus() {
  const [s, setS] = useState(getSyncStatus());
  useEffect(() => syncStatus.on(setS), []);
  return s;
}

function SyncIndicator() {
  const s = useSyncStatus();
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const label = s.progress ?? SYNC_LABELS[s.state];
  return (
    <div
      className="sync-indicator"
      title={s.error ?? (s.lastSync ? `Última sincronização: ${timeAgo(s.lastSync)}` : undefined)}
      onClick={() => (s.state === "disconnected" || s.state === "needsReauth" || s.state === "error" ? openModal("settings") : syncNow())}
    >
      <span className={`sync-dot ${s.state}`} />
      <span style={{ flex: 1 }}>
        {label}
        {s.state === "idle" && s.lastSync ? ` · ${timeAgo(s.lastSync)}` : ""}
        {s.pending > 0 && s.state !== "pending" && s.state !== "disconnected" ? ` (${s.pending})` : ""}
      </span>
      {s.state !== "disconnected" && <span title="Sincronizar agora">⟳</span>}
    </div>
  );
}

export function Sidebar({ profiles, profile }: { profiles: Profile[]; profile: Profile | undefined }) {
  const activeId = useStore(routeStore);
  const pages = useTreePages(profile?.id ?? null);
  const favorites = useLiveQuery(
    () => (profile ? db.pages.where("profileId").equals(profile.id).filter((p) => p.favorite && !p.deleted && p.trashedAt === null).toArray() : []),
    [profile?.id],
    [],
  );
  const { width } = useStore(sidebarStore);
  const mobileOpen = useStore(mobileSidebarStore);
  const resizing = useRef(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!resizing.current) return;
      const w = Math.min(480, Math.max(200, e.clientX));
      sidebarStore.set({ ...sidebarStore.get(), width: w });
    };
    const up = () => {
      resizing.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const newPage = async () => {
    if (!profile) return;
    const p = await createPage({ profileId: profile.id });
    openPage(p.id);
  };

  return (
    <>
      <div className={`mobile-backdrop${mobileOpen ? " show" : ""}`} onClick={() => mobileSidebarStore.set(false)} />
      <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`} style={{ width }}>
        <ProfileSwitcher profiles={profiles} current={profile} />
        <div className="side-item" onClick={() => openModal("search")}>
          <span className="icon">🔍</span>
          <span className="label">Buscar</span>
          <span className="faint">Ctrl+K</span>
        </div>
        <div
          className={`side-item${!activeId ? " active" : ""}`}
          onClick={() => {
            navigate(null);
            mobileSidebarStore.set(false);
          }}
        >
          <span className="icon">🏠</span>
          <span className="label">Início</span>
        </div>
        <div className="side-item" onClick={() => openModal("templates")}>
          <span className="icon">🧩</span>
          <span className="label">Templates</span>
        </div>
        <div className="side-item" onClick={() => openModal("settings")}>
          <span className="icon">⚙️</span>
          <span className="label">Configurações</span>
        </div>
        <div className="side-item" onClick={newPage}>
          <span className="icon">＋</span>
          <span className="label">Nova página</span>
        </div>

        <div className="sidebar-scroll">
          {favorites.length > 0 && (
            <>
              <div className="sidebar-section-title">Favoritos</div>
              {favorites.map((p) => (
                <div key={p.id} className={`side-item${activeId === p.id ? " active" : ""}`} onClick={() => openPage(p.id)}>
                  <span className="icon">{p.icon || "📄"}</span>
                  <span className="label">{pageTitle(p)}</span>
                </div>
              ))}
            </>
          )}
          <div className="sidebar-section-title">
            <span>Páginas</span>
            <button onClick={newPage} title="Nova página">
              ＋
            </button>
          </div>
          {pages ? <PageTree pages={pages} activeId={activeId} profiles={profiles} /> : null}
        </div>

        <div className="side-item" onClick={() => openModal("trash")} style={{ marginBottom: 4 }}>
          <span className="icon">🗑️</span>
          <span className="label">Lixeira</span>
        </div>
        <SyncIndicator />
        <div
          className="sidebar-resizer"
          onPointerDown={(e) => {
            e.preventDefault();
            resizing.current = true;
            document.body.style.cursor = "col-resize";
          }}
        />
      </aside>
    </>
  );
}
