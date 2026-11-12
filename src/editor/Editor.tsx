import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { pt } from "@blocknote/core/locales";
import { syntaxHighlighter } from "@blocknote/code-block";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "katex/dist/katex.min.css";

import { schema, type AtriumEditor, type AtriumPartialBlock } from "./schema";
import { resolveAssetUrl, storeFile } from "./assets";
import type { Page } from "../db/types";
import { db } from "../db/schema";
import { createDatabase, createPage, updatePage } from "../db/repo";
import { effectiveThemeStore, navigate, recentSlashStore, useStore } from "../lib/store";
import { pushRecent, slashItemId, withRecents } from "./recentSlash";
import { pageTitle } from "../components/ui";
import { AtriumSideMenu, BlockMoveModal } from "./BlockMenu";
import { Clapperboard, Database, FilePlus, FileText, Lightbulb, Sigma } from "lucide-react";

const dictionary = {
  ...pt,
  placeholders: {
    ...pt.placeholders,
    emptyDocument: "Digite '/' para comandos ou '@' para citar uma página…",
    default: "Digite '/' para comandos",
    callout: "Olá, sou uma frase de destaque!",
  },
};

const icon = (s: ReactNode) => <span className="slash-icon">{s}</span>;

function atriumSlashItems(editor: AtriumEditor, page: Page, flush: () => Promise<void>): DefaultReactSuggestionItem[] {
  const group = "Atrium";
  return [
    {
      title: "Página",
      subtext: "Cria uma subpágina dentro desta",
      aliases: ["pagina", "subpagina", "page", "subpage"],
      group,
      icon: icon(<FileText />),
      onItemClick: async () => {
        const child = await createPage({ profileId: page.profileId, parentId: page.id });
        insertOrUpdateBlockForSlashMenu(editor, { type: "subpage", props: { pageId: child.id } } as AtriumPartialBlock);
        await flush();
        navigate(child.id);
      },
    },
    {
      title: "Banco de dados",
      subtext: "Tabela, quadro Kanban e calendário",
      aliases: ["banco", "database", "tabela", "kanban", "quadro", "calendario", "db"],
      group,
      icon: icon(<Database />),
      onItemClick: async () => {
        const dbPage = await createDatabase(page.profileId, page.id);
        insertOrUpdateBlockForSlashMenu(editor, { type: "database", props: { databaseId: dbPage.id } } as AtriumPartialBlock);
      },
    },
    {
      title: "Frase de destaque",
      subtext: "Caixa com ícone para chamar atenção",
      aliases: ["frase", "destaque", "callout", "aviso", "nota", "dica"],
      group,
      icon: icon(<Lightbulb />),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout" } as AtriumPartialBlock),
    },
    {
      title: "Fórmula (LaTeX)",
      subtext: "Equação matemática em bloco",
      aliases: ["math", "latex", "formula", "equacao", "katex"],
      group,
      icon: icon(<Sigma />),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "math" } as AtriumPartialBlock),
    },
    {
      title: "Incorporar link",
      subtext: "YouTube, Vimeo, Spotify, Google Docs, Figma…",
      aliases: ["embed", "incorporar", "youtube", "video", "iframe", "spotify"],
      group,
      icon: icon(<Clapperboard />),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "embed" } as AtriumPartialBlock),
    },
    {
      title: "PDF",
      subtext: "Visualizar um PDF dentro da página",
      aliases: ["pdf", "documento"],
      group,
      icon: icon(<FileText />),
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "pdf" } as AtriumPartialBlock),
    },
  ];
}

async function mentionItems(editor: AtriumEditor, page: Page, query: string): Promise<DefaultReactSuggestionItem[]> {
  const q = query.trim().toLowerCase();
  const pages = await db.pages
    .where("profileId")
    .equals(page.profileId)
    .filter((p) => !p.deleted && p.trashedAt === null && !p.isTemplate && p.id !== page.id && (!q || p.title.toLowerCase().includes(q)))
    .limit(12)
    .toArray();
  const insert = (id: string, title: string) => {
    editor.insertInlineContent([{ type: "pageLink", props: { pageId: id, title } }, " "] as never);
  };
  const items: DefaultReactSuggestionItem[] = pages.map((p) => ({
    title: pageTitle(p),
    icon: icon(p.icon || "📄"),
    group: "Páginas",
    onItemClick: () => insert(p.id, p.title),
  }));
  if (q) {
    items.push({
      title: `Nova página "${query.trim()}"`,
      subtext: "Cria uma subpágina e insere o link",
      icon: icon(<FilePlus />),
      group: "Criar",
      onItemClick: async () => {
        const child = await createPage({ profileId: page.profileId, parentId: page.id, title: query.trim() });
        insert(child.id, child.title);
      },
    });
  }
  return items;
}

export function PageEditor({
  page,
  editable = true,
  reloadToken = 0,
  children,
}: {
  page: Page;
  editable?: boolean;
  reloadToken?: number;
  children?: ReactNode;
}) {
  const theme = useStore(effectiveThemeStore);
  const pageRef = useRef(page);
  pageRef.current = page;

  const editor = useCreateBlockNote(
    {
      schema,
      dictionary,
      initialContent: page.content?.length ? (page.content as AtriumPartialBlock[]) : undefined,
      uploadFile: (file: File) => storeFile(file, pageRef.current.profileId, pageRef.current.id),
      resolveFileUrl: resolveAssetUrl,
      extensions: [syntaxHighlighter],
      tables: { splitCells: true, cellBackgroundColor: true, cellTextColor: true, headers: true },
    },
    [page.id],
  );

  // Salvamento com atraso curto enquanto digita; garantido ao sair da página.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);
  const flush = useMemo(
    () => async () => {
      clearTimeout(timer.current);
      if (!dirty.current) return;
      dirty.current = false;
      await updatePage(pageRef.current.id, { content: editor.document as unknown[] });
    },
    [editor],
  );

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  // Conteúdo trocado por fora (sincronização, template, versão restaurada): recarrega do banco.
  const suppress = useRef(false);
  const firstToken = useRef(reloadToken);
  useEffect(() => {
    if (reloadToken === firstToken.current) return;
    // Se o usuário está digitando agora, a edição local (mais nova) prevalece.
    if (dirty.current) return;
    let alive = true;
    db.pages.get(pageRef.current.id).then((fresh) => {
      if (!alive || !fresh) return;
      const blocks = (fresh.content?.length ? fresh.content : [{ type: "paragraph" }]) as AtriumPartialBlock[];
      suppress.current = true;
      try {
        editor.replaceBlocks(editor.document, blocks);
      } finally {
        setTimeout(() => (suppress.current = false));
      }
    });
    return () => {
      alive = false;
    };
  }, [reloadToken, editor]);

  const onChange = () => {
    if (!editable || suppress.current) return;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 500);
  };

  // Clicar no espaço vazio abaixo do conteúdo leva o cursor para o fim (criando uma linha se preciso), como no Notion.
  const focusEnd = () => {
    if (!editable) return;
    const doc = editor.document;
    const last = doc[doc.length - 1];
    const lastIsEmptyParagraph = last?.type === "paragraph" && Array.isArray(last.content) && last.content.length === 0;
    if (!lastIsEmptyParagraph) editor.insertBlocks([{ type: "paragraph" }], last, "after");
    const target = editor.document[editor.document.length - 1];
    editor.setTextCursorPosition(target, "end");
    editor.focus();
  };

  return (
    <>
      <BlockNoteView editor={editor} theme={theme} editable={editable} onChange={onChange} slashMenu={false} sideMenu={false}>
      <AtriumSideMenu />
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => {
          const items = filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), ...atriumSlashItems(editor, pageRef.current, flush)],
            query,
          );
          // Sem nada digitado depois da "/", os últimos 5 itens usados aparecem no topo.
          const list = query.trim() ? items : withRecents(items, recentSlashStore.get());
          // Só o título de cada opção: a descrição (subtext) é removida depois do filtro,
          // então a busca continua encontrando pelos apelidos (aliases).
          return list.map((item) => ({ ...item, subtext: undefined }));
        }}
        onItemClick={(item) => {
          recentSlashStore.set(pushRecent(recentSlashStore.get(), slashItemId(item)));
          item.onItemClick();
        }}
      />
      <SuggestionMenuController triggerCharacter="@" getItems={(query) => mentionItems(editor, pageRef.current, query)} />
      </BlockNoteView>
      {editable && <BlockMoveModal editor={editor} page={page} />}
      {children}
      <div className="editor-tail" onClick={focusEnd} />
    </>
  );
}
