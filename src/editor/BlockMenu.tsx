// Menu dos 6 pontinhos ao lado de cada bloco (como no Notion):
// Transformar em…, Duplicar, Mover para…, Cores e Excluir.

import { useMemo, useState, type ReactNode } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  BlockColorsItem,
  DragHandleMenu,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
  usePortalElement,
} from "@blocknote/react";
import {
  ChevronRight,
  Code,
  Copy,
  CornerUpRight,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  Palette,
  Quote,
  Repeat,
  Trash2,
  Type,
} from "lucide-react";
import type { AtriumBlock, AtriumEditor, AtriumPartialBlock } from "./schema";
import { appendBlocks, cloneWithoutIds, linkedPageIds } from "./blockOps";
import { createStore, useStore } from "../lib/store";
import type { Page } from "../db/types";
import { db } from "../db/schema";
import { movePage, updatePage } from "../db/repo";
import { useTreePages } from "../db/hooks";
import { Modal, pageTitle, toast } from "../components/ui";

/** Tipos de bloco para "Transformar em". Só valem para blocos de texto. */
const TURN_INTO: { label: string; icon: ReactNode; type: string; props?: Record<string, unknown> }[] = [
  { label: "Texto", icon: <Type />, type: "paragraph" },
  { label: "Título 1", icon: <Heading1 />, type: "heading", props: { level: 1, isToggleable: false } },
  { label: "Título 2", icon: <Heading2 />, type: "heading", props: { level: 2, isToggleable: false } },
  { label: "Título 3", icon: <Heading3 />, type: "heading", props: { level: 3, isToggleable: false } },
  { label: "Lista com marcadores", icon: <List />, type: "bulletListItem" },
  { label: "Lista numerada", icon: <ListOrdered />, type: "numberedListItem" },
  { label: "Lista de tarefas", icon: <ListChecks />, type: "checkListItem" },
  { label: "Lista de alternância", icon: <ListCollapse />, type: "toggleListItem" },
  { label: "Citação", icon: <Quote />, type: "quote" },
  { label: "Frase de destaque", icon: <Lightbulb />, type: "callout" },
  { label: "Código", icon: <Code />, type: "codeBlock" },
];

const isTextBlock = (b: AtriumBlock) => Array.isArray(b.content);

/** Blocos afetados: os selecionados (se o bloco clicado faz parte da seleção) ou só o clicado. */
function targetBlocks(editor: AtriumEditor, block: AtriumBlock): AtriumBlock[] {
  const sel = editor.getSelection()?.blocks;
  return sel && sel.some((b) => b.id === block.id) ? sel : [block];
}

// Pedido de "Mover para…" (ids dos blocos); a janela é mostrada pelo PageEditor.
export const blockMoveStore = createStore<string[] | null>(null);

function useMenuBlock() {
  const editor = useBlockNoteEditor() as unknown as AtriumEditor;
  const block = useExtensionState(SideMenuExtension, { editor, selector: (s) => s?.block }) as AtriumBlock | undefined;
  return { editor, block };
}

function TurnIntoItem() {
  const C = useComponentsContext()!;
  const portal = usePortalElement();
  const { editor, block } = useMenuBlock();
  if (!block || !isTextBlock(block)) return null;
  const isCurrent = (t: (typeof TURN_INTO)[number]) =>
    block.type === t.type && (t.type !== "heading" || (block.props as { level?: number }).level === t.props?.level);
  return (
    <C.Generic.Menu.Root position="right" sub portalElement={portal}>
      <C.Generic.Menu.Trigger sub>
        <C.Generic.Menu.Item className="bn-menu-item" subTrigger icon={<Repeat />}>
          Transformar em
        </C.Generic.Menu.Item>
      </C.Generic.Menu.Trigger>
      <C.Generic.Menu.Dropdown sub className="bn-menu-dropdown turn-into-menu">
        {TURN_INTO.map((t) => (
          <C.Generic.Menu.Item
            key={t.label}
            className="bn-menu-item"
            icon={t.icon}
            checked={isCurrent(t)}
            onClick={() => {
              editor.transact(() => {
                for (const b of targetBlocks(editor, block)) {
                  if (isTextBlock(b)) editor.updateBlock(b, { type: t.type, props: t.props ?? {} } as AtriumPartialBlock);
                }
              });
            }}
          >
            {t.label}
          </C.Generic.Menu.Item>
        ))}
      </C.Generic.Menu.Dropdown>
    </C.Generic.Menu.Root>
  );
}

function DuplicateItem() {
  const C = useComponentsContext()!;
  const { editor, block } = useMenuBlock();
  if (!block) return null;
  return (
    <C.Generic.Menu.Item
      className="bn-menu-item"
      icon={<Copy />}
      onClick={() => {
        const blocks = targetBlocks(editor, block);
        editor.insertBlocks(blocks.map((b) => cloneWithoutIds(b) as AtriumPartialBlock), blocks[blocks.length - 1], "after");
      }}
    >
      Duplicar
    </C.Generic.Menu.Item>
  );
}

function MoveItem() {
  const C = useComponentsContext()!;
  const { editor, block } = useMenuBlock();
  if (!block) return null;
  return (
    <C.Generic.Menu.Item
      className="bn-menu-item"
      icon={<CornerUpRight />}
      onClick={() => blockMoveStore.set(targetBlocks(editor, block).map((b) => b.id))}
    >
      Mover para…
    </C.Generic.Menu.Item>
  );
}

function RemoveItem() {
  const C = useComponentsContext()!;
  const { editor, block } = useMenuBlock();
  if (!block) return null;
  return (
    <C.Generic.Menu.Item className="bn-menu-item" icon={<Trash2 />} onClick={() => editor.removeBlocks(targetBlocks(editor, block))}>
      Excluir
    </C.Generic.Menu.Item>
  );
}

/** Controlador do menu lateral do Atrium (usar dentro do BlockNoteView com sideMenu={false}). */
export function AtriumSideMenu() {
  return (
    <SideMenuController
      sideMenu={(props) => (
        <SideMenu
          {...props}
          dragHandleMenu={() => (
            <DragHandleMenu>
              <TurnIntoItem />
              <DuplicateItem />
              <MoveItem />
              <BlockColorsItem>
                <span className="menu-label-icon">
                  <Palette />
                </span>
                Cores
              </BlockColorsItem>
              <TableRowHeaderItem>Cabeçalho de linha</TableRowHeaderItem>
              <TableColumnHeaderItem>Cabeçalho de coluna</TableColumnHeaderItem>
              <RemoveItem />
            </DragHandleMenu>
          )}
        />
      )}
    />
  );
}

/** Janela "Mover para…" de blocos: escolhe a página de destino (no mesmo perfil). */
export function BlockMoveModal({ editor, page }: { editor: AtriumEditor; page: Page }) {
  const ids = useStore(blockMoveStore);
  const pages = useTreePages(ids ? page.profileId : null);
  const [query, setQuery] = useState("");
  const close = () => {
    blockMoveStore.set(null);
    setQuery("");
  };

  const list = useMemo(() => {
    const all = (pages ?? []).filter((p) => p.kind === "page" && p.id !== page.id);
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
  }, [pages, page.id, query]);

  if (!ids) return null;

  const moveTo = async (target: Page) => {
    const blocks = ids.map((id) => editor.getBlock(id)).filter((b): b is AtriumBlock => !!b);
    close();
    if (!blocks.length) return;
    // Lê a página de destino direto do banco (a lista ao vivo pode estar atrasada).
    const fresh = await db.pages.get(target.id);
    if (!fresh) return;
    const copies = JSON.parse(JSON.stringify(blocks)) as unknown[];
    await updatePage(target.id, { content: appendBlocks(fresh.content ?? [], copies) });
    // Subpáginas e bancos de dados movidos passam a ficar dentro da página de destino.
    for (const id of linkedPageIds(blocks as never)) {
      const child = await db.pages.get(id);
      if (child?.parentId === page.id) await movePage(id, { parentId: target.id, order: Date.now() });
    }
    editor.removeBlocks(blocks);
    toast(`${blocks.length > 1 ? `${blocks.length} blocos movidos` : "Bloco movido"} para “${pageTitle(target)}”`);
  };

  return (
    <Modal title={ids.length > 1 ? `Mover ${ids.length} blocos para…` : "Mover bloco para…"} onClose={close}>
      <input
        className="input"
        autoFocus
        placeholder="Procurar página de destino…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
        {list.map(({ page: p, depth }) => (
          <div key={p.id} className="list-row" style={{ cursor: "pointer", paddingLeft: 8 + depth * 16 }} onClick={() => moveTo(p)}>
            <span className="icon">{p.icon || <FileText />}</span>
            <span className="grow">{pageTitle(p)}</span>
            <ChevronRight className="faint" />
          </div>
        ))}
        {!list.length && <div className="faint" style={{ padding: 12, textAlign: "center" }}>Nenhuma página encontrada.</div>}
      </div>
    </Modal>
  );
}
