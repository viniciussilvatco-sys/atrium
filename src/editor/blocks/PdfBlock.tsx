import { useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { useResolvedUrl } from "../assets";

function PdfView({ url, name }: { url: string; name: string }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return <div className="embed-placeholder">Carregando PDF…</div>;
  return (
    <div className="embed-block">
      <iframe className="pdf-frame" src={resolved} title={name || "PDF"} />
      <div className="faint" style={{ marginTop: 4 }}>
        📄 {name || "documento.pdf"} ·{" "}
        <a href={resolved} target="_blank" rel="noreferrer" download={name || "documento.pdf"}>
          abrir / baixar
        </a>
      </div>
    </div>
  );
}

function PdfUpload({ onFile }: { onFile: (f: File) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="embed-placeholder">
      <span>📄</span>
      <span style={{ flex: 1 }}>Incorporar um PDF</span>
      <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Enviando…" : "Escolher arquivo"}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            await onFile(f);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export const createPdfBlock = createReactBlockSpec(
  {
    type: "pdf",
    propSchema: { url: { default: "" }, name: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      if (!block.props.url) {
        if (!editor.isEditable) return <div />;
        return (
          <PdfUpload
            onFile={async (f) => {
              const res = await editor.uploadFile?.(f, block.id);
              const url = typeof res === "string" ? res : String((res as Record<string, unknown>)?.url ?? "");
              editor.updateBlock(block, { props: { url, name: f.name } });
            }}
          />
        );
      }
      return <PdfView url={block.props.url} name={block.props.name} />;
    },
  },
);
