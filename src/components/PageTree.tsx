import { useState } from "react";
import type { Page, Profile } from "../db/types";
import { createDatabase, createPage, createRow, duplicatePage, movePage, trashPage, updatePage } from "../db/repo";
import { mobileSidebarStore, navigate, sidebarStore, useStore } from "../lib/store";
import { Menu, pageTitle, toast, type Anchor, type MenuEntry } from "./ui";

let dragId: string | null = null;

type DropZone = "before" | "inside" | "after";

function zoneFor(e: React.DragEvent): DropZone {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - r.top;
  if (y < r.height * 0.28) return "before";
  if (y > r.height * 0.72) return "after";
  return "inside";
}

export function openPage(id: string) {
  navigate(id);
  mobileSidebarStore.set(false);
}

export function setExpanded(id: string, open: boolean) {
  const s = sidebarStore.get();
  sidebarStore.set({ ...s, expanded: { ...s.expanded, [id]: open } });
}

export function pageMenuItems(page: Page, profiles: Profile[], extra: { onRename?: () => void } = {}): MenuEntry[] {
  return [
    {
      label: page.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos",
      icon: page.favorite ? "☆" : "★",
      onClick: () => updatePage(page.id, { favorite: !page.favorite }),
    },
    { label: "Renomear", icon: "✎", onClick: extra.onRename, hidden: !extra.onRename },
    {
      label: "Duplicar",
      icon: "⧉",
      onClick: async () => {
        const copy = await duplicatePage(page.id);
        if (copy) openPage(copy.id);
      },
    },
    {
      label: "Copiar link",
      icon: "🔗",
      onClick: () => {
        navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/${page.id}`);
        toast("Link copiado");
      },
    },
    ...(profiles.length > 1
      ? [
          { heading: "Mover para o perfil" } as MenuEntry,
          ...profiles
            .filter((p) => p.id !== page.profileId)
            .map((p) => ({
              label: p.name,
              icon: p.icon,
              onClick: async () => {
                await movePage(page.id, { parentId: null, order: Date.now(), profileId: p.id });
                toast(`Movida para ${p.name}`);
              },
            })),
        ]
      : []),
    { separator: true },
    {
      label: "Mover para a lixeira",
      icon: "🗑",
      danger: true,
      onClick: async () => {
        await trashPage(page.id);
        if (location.hash.includes(page.id)) navigate(null);
        toast("Página movida para a lixeira");
      },
    },
  ];
}

function TreeItem({
  page,
  depth,
  childrenOf,
  activeId,
  profiles,
}: {
  page: Page;
  depth: number;
  childrenOf: Map<string | null, Page[]>;
  activeId: string | null;
  profiles: Profile[];
}) {
  const { expanded } = useStore(sidebarStore);
  const open = !!expanded[page.id];
  const kids = childrenOf.get(page.id) ?? [];
  const [drop, setDrop] = useState<DropZone | null>(null);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [addMenu, setAddMenu] = useState<Anchor | null>(null);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zone = drop;
    setDrop(null);
    const id = dragId;
    dragId = null;
    if (!id || id === page.id || !zone) return;
    if (zone === "inside") {
      const last = kids[kids.length - 1];
      await movePage(id, { parentId: page.id, order: last ? last.order + 1 : 0 });
      setExpanded(page.id, true);
      return;
    }
    const siblings = (childrenOf.get(page.parentId) ?? []).filter((s) => s.id !== id);
    const idx = siblings.findIndex((s) => s.id === page.id);
    const neighbor = zone === "before" ? siblings[idx - 1] : siblings[idx + 1];
    const order = neighbor ? (page.order + neighbor.order) / 2 : zone === "before" ? page.order - 1 : page.order + 1;
    await movePage(id, { parentId: page.parentId, order });
  };

  const addChild = async (kind: "page" | "database") => {
    const child =
      page.kind === "database"
        ? await createRow(page)
        : kind === "page"
          ? await createPage({ profileId: page.profileId, parentId: page.id })
          : await createDatabase(page.profileId, page.id);
    if (page.kind === "database") return openPage(child.id);
    setExpanded(page.id, true);
    openPage(child.id);
  };

  return (
    <>
      <div
        className={`side-item${activeId === page.id ? " active" : ""}${menu ? " menu-open" : ""}${drop ? ` drop-${drop}` : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable
        onDragStart={(e) => {
          dragId = page.id;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", pageTitle(page));
        }}
        onDragOver={(e) => {
          if (!dragId || dragId === page.id) return;
          e.preventDefault();
          setDrop(zoneFor(e));
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={onDrop}
        onClick={() => openPage(page.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(page.id, !open);
          }}
          aria-label={open ? "Recolher" : "Expandir"}
        >
          <span className={`chevron${open ? " open" : ""}`}>▶</span>
        </button>
        <span className="icon">{page.icon || (page.kind === "database" ? "🗂️" : "📄")}</span>
        <span className="label">{pageTitle(page)}</span>
        <span className="actions">
          <button
            className="icon-btn"
            title="Mais opções"
            onClick={(e) => {
              e.stopPropagation();
              setMenu(e.currentTarget);
            }}
          >
            ⋯
          </button>
          <button
            className="icon-btn"
            title="Adicionar dentro"
            onClick={(e) => {
              e.stopPropagation();
              if (page.kind === "database") addChild("page");
              else setAddMenu(e.currentTarget);
            }}
          >
            ＋
          </button>
        </span>
      </div>
      {open &&
        (kids.length ? (
          kids.map((k) => <TreeItem key={k.id} page={k} depth={depth + 1} childrenOf={childrenOf} activeId={activeId} profiles={profiles} />)
        ) : (
          <div className="tree-empty" style={{ paddingLeft: 30 + (depth + 1) * 14 }}>
            {page.kind === "database" ? "Itens do banco ficam dentro dele" : "Sem subpáginas"}
          </div>
        ))}
      {menu && <Menu anchor={menu} onClose={() => setMenu(null)} items={pageMenuItems(page, profiles)} />}
      {addMenu && (
        <Menu
          anchor={addMenu}
          onClose={() => setAddMenu(null)}
          items={[
            { label: "Subpágina", icon: "📄", onClick: () => addChild("page") },
            { label: "Banco de dados", icon: "🗂️", onClick: () => addChild("database") },
          ]}
        />
      )}
    </>
  );
}

export function PageTree({ pages, activeId, profiles }: { pages: Page[]; activeId: string | null; profiles: Profile[] }) {
  const childrenOf = new Map<string | null, Page[]>();
  const ids = new Set(pages.map((p) => p.id));
  for (const p of pages) {
    // Páginas cujo pai sumiu (ex.: pai na lixeira) aparecem na raiz.
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), p]);
  }
  const roots = childrenOf.get(null) ?? [];
  return (
    <div
      onDragOver={(e) => dragId && e.preventDefault()}
      onDrop={async (e) => {
        // Soltar no espaço vazio abaixo da árvore: vai para o fim da raiz.
        if (!dragId) return;
        e.preventDefault();
        const id = dragId;
        dragId = null;
        const last = roots[roots.length - 1];
        await movePage(id, { parentId: null, order: last ? last.order + 1 : 0 });
      }}
      style={{ minHeight: 40 }}
    >
      {roots.map((p) => (
        <TreeItem key={p.id} page={p} depth={0} childrenOf={childrenOf} activeId={activeId} profiles={profiles} />
      ))}
      {!roots.length && <div className="tree-empty" style={{ paddingLeft: 16 }}>Nenhuma página ainda</div>}
    </div>
  );
}
