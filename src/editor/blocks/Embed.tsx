import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { toEmbedUrl } from "../../lib/embed";

function UrlPrompt({ placeholder, onSubmit }: { placeholder: string; onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="embed-placeholder" onKeyDown={(e) => e.stopPropagation()} onPaste={(e) => e.stopPropagation()}>
      <span>🔗</span>
      <input
        className="input"
        placeholder={placeholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && url.trim()) onSubmit(url.trim());
        }}
      />
      <button className="btn primary" disabled={!url.trim()} onClick={() => onSubmit(url.trim())}>
        Incorporar
      </button>
    </div>
  );
}

export const createEmbed = createReactBlockSpec(
  {
    type: "embed",
    propSchema: { url: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { url } = block.props;
      if (!url) {
        return editor.isEditable ? (
          <UrlPrompt
            placeholder="Cole um link do YouTube, Vimeo, Spotify, Google Docs, Figma…"
            onSubmit={(u) => editor.updateBlock(block, { props: { url: u } })}
          />
        ) : (
          <div />
        );
      }
      const embed = toEmbedUrl(url);
      if (embed) {
        return (
          <div className="embed-block">
            <iframe
              className="embed-frame"
              src={embed}
              title={url}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          </div>
        );
      }
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        /* mantém o texto */
      }
      return (
        <a className="link-card" href={url} target="_blank" rel="noreferrer">
          <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} width={16} height={16} alt="" />
          <span style={{ fontWeight: 500 }}>{host}</span>
          <span className="faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {url}
          </span>
        </a>
      );
    },
  },
);
