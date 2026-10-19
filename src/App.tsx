import { useEffect } from "react";
import { useProfiles, usePage } from "./db/hooks";
import { db } from "./db/schema";
import {
  currentProfileStore,
  effectiveThemeStore,
  modalStore,
  openModal,
  routeStore,
  sidebarStore,
  useStore,
} from "./lib/store";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PageView } from "./components/PageView";
import { Home } from "./components/Home";
import { Welcome } from "./components/Welcome";
import { SearchPalette } from "./components/SearchPalette";
import { SettingsModal } from "./components/SettingsModal";
import { ConflictsModal, TemplatesModal, TrashModal } from "./components/Modals";
import { ToastHost } from "./components/ui";
import { useSyncStatus } from "./components/Sidebar";

export default function App() {
  const profiles = useProfiles();
  const currentId = useStore(currentProfileStore);
  const route = useStore(routeStore);
  const modal = useStore(modalStore);
  const theme = useStore(effectiveThemeStore);
  const { collapsed } = useStore(sidebarStore);
  const routePage = usePage(route);
  const sync = useSyncStatus();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#191919" : "#ffffff");
  }, [theme]);

  // Abrir um link de página de outro perfil troca o perfil ativo.
  // Só reage quando a página aberta muda (não quando o perfil muda), para não desfazer uma troca de perfil.
  const routeProfile = routePage && !routePage.deleted ? routePage.profileId : null;
  useEffect(() => {
    if (routeProfile && routeProfile !== currentProfileStore.get()) currentProfileStore.set(routeProfile);
  }, [routePage?.id, routeProfile]);

  // Garante que o perfil ativo exista (ex.: foi excluído em outro aparelho).
  // Confere no banco, porque a lista ao vivo pode ainda não incluir um perfil recém-criado.
  useEffect(() => {
    if (!profiles?.length || profiles.some((p) => p.id === currentId)) return;
    let alive = true;
    (currentId ? db.profiles.get(currentId) : Promise.resolve(undefined)).then((p) => {
      if (alive && (!p || p.deleted) && currentProfileStore.get() === currentId) currentProfileStore.set(profiles[0].id);
    });
    return () => {
      alive = false;
    };
  }, [profiles, currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openModal(modalStore.get() === "search" ? null : "search");
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        const s = sidebarStore.get();
        sidebarStore.set({ ...s, collapsed: !s.collapsed });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (profiles === undefined) return null;
  if (!profiles.length) return <Welcome />;

  const profile = profiles.find((p) => p.id === currentId) ?? profiles[0];
  const close = () => modalStore.set(null);

  return (
    <div className={`app${collapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar profiles={profiles} profile={profile} />
      <main className="main">
        {sync.state === "needsReauth" && (
          <div className="banner">
            A sessão do Google expirou. Toque em qualquer lugar ou em
            <button className="btn" onClick={() => openModal("settings")}>
              Reconectar
            </button>
          </div>
        )}
        <Topbar page={route ? routePage : undefined} profile={profile} profiles={profiles} />
        <div className="scroll-area">{route ? <PageView key={route} pageId={route} /> : <Home profile={profile} />}</div>
      </main>

      {modal === "search" && <SearchPalette onClose={close} profiles={profiles} />}
      {modal === "settings" && <SettingsModal profile={profile} onClose={close} />}
      {modal === "trash" && <TrashModal profile={profile} onClose={close} />}
      {modal === "templates" && <TemplatesModal profile={profile} onClose={close} />}
      {modal === "conflicts" && route && <ConflictsModal pageId={route} onClose={close} />}
      <ToastHost />
    </div>
  );
}
