import { useMemo, useState } from "react";
import katex from "katex";
import { createReactBlockSpec } from "@blocknote/react";

export function renderLatex(latex: string, displayMode = true): { html: string; error: string | null } {
  try {
    return { html: katex.renderToString(latex, { displayMode, throwOnError: true, strict: "ignore" }), error: null };
  } catch (e) {
    return { html: "", error: (e as Error).message.replace(/^KaTeX parse error: /, "") };
  }
}

function MathView({ latex, editable, onSave }: { latex: string; editable: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(!latex && editable);
  const [draft, setDraft] = useState(latex);
  const preview = useMemo(() => renderLatex(editing ? draft : latex), [editing, draft, latex]);

  const commit = () => {
    setEditing(false);
    if (draft !== latex) onSave(draft);
  };

  if (editing) {
    return (
      <div className="math-editor" onKeyDown={(e) => e.stopPropagation()} onPaste={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          value={draft}
          placeholder="Digite uma fórmula LaTeX, ex.: E = mc^2   ou   \int_0^1 x^2\,dx"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)) || e.key === "Escape") {
              e.preventDefault();
              commit();
            }
          }}
        />
        {draft && (preview.error ? <div className="math-error">{preview.error}</div> : <div dangerouslySetInnerHTML={{ __html: preview.html }} />)}
        <div className="faint">Ctrl+Enter para concluir</div>
      </div>
    );
  }

  return (
    <div
      className="math-block"
      onClick={() => {
        if (!editable) return;
        setDraft(latex);
        setEditing(true);
      }}
    >
      {!latex ? (
        <div className="math-empty">∑ Clique para adicionar uma fórmula</div>
      ) : preview.error ? (
        <div className="math-error">{preview.error}</div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: preview.html }} />
      )}
    </div>
  );
}

export const createMathBlock = createReactBlockSpec(
  {
    type: "math",
    propSchema: { latex: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <MathView
        latex={block.props.latex}
        editable={editor.isEditable}
        onSave={(latex) => editor.updateBlock(block, { props: { latex } })}
      />
    ),
    toExternalHTML: ({ block }) => <div dangerouslySetInnerHTML={{ __html: renderLatex(block.props.latex).html }} />,
  },
);
