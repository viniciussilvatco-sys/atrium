import { createReactBlockSpec, createReactInlineContentSpec } from "@blocknote/react";
import { usePage } from "../../db/hooks";
import { navigate } from "../../lib/store";
import { pageTitle } from "../../components/ui";
import { DatabaseView } from "../../database/DatabaseView";

function SubpageLink({ pageId }: { pageId: string }) {
  const page = usePage(pageId);
  const gone = page && (page.deleted || page.trashedAt !== null);
  return (
    <div className="subpage-block" contentEditable={false} onClick={() => !gone && navigate(pageId)}>
      <span>{page?.icon || (page?.kind === "database" ? "🗂️" : "📄")}</span>
      <span className="t" style={gone ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>
        {page === undefined ? "…" : pageTitle(page)}
      </span>
      {gone && <span className="faint">(na lixeira)</span>}
    </div>
  );
}

/** Bloco "Página": link em destaque para uma subpágina, como no Notion. */
export const createSubpageBlock = createReactBlockSpec(
  {
    type: "subpage",
    propSchema: { pageId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block }) => <SubpageLink pageId={block.props.pageId} />,
  },
);

/** Banco de dados incorporado dentro de uma página. */
export const createDatabaseBlock = createReactBlockSpec(
  {
    type: "database",
    propSchema: { databaseId: { default: "" } },
    content: "none",
  },
  {
    render: ({ block }) => (
      <div
        className="inline-db"
        contentEditable={false}
        onKeyDown={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onDrop={(e) => e.stopPropagation()}
      >
        <DatabaseView databaseId={block.props.databaseId} inline />
      </div>
    ),
  },
);

function PageLinkChip({ pageId, fallback }: { pageId: string; fallback: string }) {
  const page = usePage(pageId);
  return (
    <span className="page-link" onClick={() => navigate(pageId)}>
      {page?.icon || "📄"} {page ? pageTitle(page) : fallback || "Página"}
    </span>
  );
}

/** Menção a outra página, inserida digitando "@". */
export const pageLinkSpec = createReactInlineContentSpec(
  {
    type: "pageLink",
    propSchema: { pageId: { default: "" }, title: { default: "" } },
    content: "none",
  },
  {
    render: ({ inlineContent }) => <PageLinkChip pageId={inlineContent.props.pageId} fallback={inlineContent.props.title} />,
  },
);
