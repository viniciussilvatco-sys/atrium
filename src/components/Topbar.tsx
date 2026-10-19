import { useState } from "react";
import type { Page, Profile } from "../db/types";
import { useAncestors } from "../db/hooks";
import { updatePage } from "../db/repo";
import { exportPage } from "../export/exporter";
import { saveAsTemplate } from "../templates/builtin";
import { mobileSidebarStore, navigate, openModal, sidebarStore } from "../lib/store";
import { pageMenuItems } from "./PageTree";
import { Menu, pageTitle, timeAgo, toast, type Anchor } from "./ui";

function toggleSidebar() {
  if (window.matchMedia("(max-width: 768px)").matches) mobileSidebarStore.set(!mobileSidebarStore.get());
  else {
    const s = sidebarStore.get();
    sidebarStore.set({ ...s, collapsed: !s.collapsed });
  }
}

export function Topbar({ page, profile, profiles }: { page: Page | undefined; profile: Profile | undefined; profiles: Profile[] }) {
  const ancestors = useAncestors(page);
  const [menu, setMenu] = useState<Anchor | null>(null);

  return (
    <div className="topbar">
      <button className="topbar-btn" onClick={toggleSidebar} title="Mostrar/ocultar barra lateral (Ctrl+\)" aria-label="Menu">
        ☰
      </button>
      <div className="breadcrumbs">
        {profile && (
          <span className="crumb" onClick={() => navigate(null)}>
            {profile.icon} {profile.name}
          </span>
        )}
        {page &&
          [...ancestors.filter((a) => a.id !== page.id), page].map((p) => (
            <span key={p.id} style={{ display: "contents" }}>
              <span className="crumb-sep">/</span>
              <span className="crumb" onClick={() => navigate(p.id)}>
                {p.icon ? `${p.icon} ` : ""}
                {pageTitle(p)}
              </span>
            </span>
          ))}
      </div>
      {page && !page.deleted && (
        <>
          <span className="faint" style={{ whiteSpace: "nowrap" }} title={new Date(page.updatedAt).toLocaleString("pt-BR")}>
            {window.innerWidth > 600 ? `Editado ${timeAgo(page.updatedAt)}` : ""}
          </span>
          <button
            className="topbar-btn"
            title={page.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            onClick={() => updatePage(page.id, { favorite: !page.favorite })}
            style={page.favorite ? { color: "#d9a441" } : undefined}
          >
            {page.favorite ? "★" : "☆"}
          </button>
          <button className="topbar-btn" onClick={(e) => setMenu(e.currentTarget)} title="Mais opções" aria-label="Mais opções">
            ⋯
          </button>
        </>
      )}
      {menu && page && (
        <Menu
          anchor={menu}
          align="end"
          onClose={() => setMenu(null)}
          items={[
            {
              label: page.fullWidth ? "Largura padrão" : "Largura total",
              icon: "↔",
              onClick: () => updatePage(page.id, { fullWidth: !page.fullWidth }),
              hidden: page.kind === "database",
            },
            {
              label: "Exportar (Markdown .zip)",
              icon: "⬇",
              onClick: async () => {
                toast("Gerando exportação…");
                await exportPage(page.id);
              },
            },
            { label: "Imprimir / salvar como PDF", icon: "🖨", onClick: () => setTimeout(() => window.print(), 50) },
            {
              label: "Salvar como template",
              icon: "🧩",
              hidden: page.isTemplate,
              onClick: async () => {
                await saveAsTemplate(page.id);
                toast("Template salvo! Ele aparece em Templates e em páginas novas.");
              },
            },
            { label: `Versões em conflito (${page.conflicts?.length ?? 0})`, icon: "⚠", hidden: !page.conflicts?.length, onClick: () => openModal("conflicts") },
            { separator: true },
            ...pageMenuItems(page, profiles),
          ]}
        />
      )}
    </div>
  );
}
