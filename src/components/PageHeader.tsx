import { useEffect, useRef, useState } from "react";
import type { Page } from "../db/types";
import { updatePage } from "../db/repo";
import { storeFile, useResolvedUrl } from "../editor/assets";
import { EmojiPicker, RANDOM_ICONS } from "./EmojiPicker";
import { Popover, type Anchor } from "./ui";

export const COVER_PRESETS = [
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)",
  "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
  "linear-gradient(135deg, #434343 0%, #000000 100%)",
  "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
  "linear-gradient(135deg, #d4a373 0%, #7f5539 100%)",
  "#e03e3e",
  "#d9730d",
  "#0f7b6c",
  "#2383e2",
];

function coverStyle(cover: string, resolved: string | null): React.CSSProperties {
  if (cover.startsWith("linear-gradient") || cover.startsWith("#")) return { background: cover };
  return { backgroundImage: resolved ? `url("${resolved}")` : undefined, backgroundColor: "var(--bg-hover)" };
}

function CoverPicker({ page, anchor, onClose }: { page: Page; anchor: Anchor; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const set = (cover: string | null) => {
    updatePage(page.id, { cover });
    onClose();
  };
  return (
    <Popover anchor={anchor} onClose={onClose} width={340} align="end">
      <div className="menu-label">Cores e degradês</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 4 }}>
        {COVER_PRESETS.map((c) => (
          <button key={c} onClick={() => set(c)} style={{ height: 40, borderRadius: 4, background: c }} aria-label="Capa" />
        ))}
      </div>
      <div className="menu-label">Imagem</div>
      <button className="menu-item" onClick={() => input.current?.click()}>
        <span className="mi-icon">⬆</span> Enviar imagem do dispositivo
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) set(await storeFile(f, page.profileId, page.id));
        }}
      />
      <div className="row" style={{ padding: 4, flexWrap: "nowrap" }}>
        <input className="input" placeholder="…ou cole o link de uma imagem" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn" disabled={!/^https?:\/\//.test(link)} onClick={() => set(link)}>
          OK
        </button>
      </div>
      {page.cover && (
        <button className="menu-item danger" onClick={() => set(null)}>
          <span className="mi-icon">✕</span> Remover capa
        </button>
      )}
    </Popover>
  );
}

function TitleInput({ page, onEnter }: { page: Page; onEnter?: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(page.title);
  const lastSaved = useRef(page.title);

  // Atualiza o título se ele mudar por fora (sync, renomear na tabela...).
  useEffect(() => {
    if (page.title !== lastSaved.current && document.activeElement !== ref.current) {
      setValue(page.title);
      lastSaved.current = page.title;
    }
  }, [page.title]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const pending = useRef(value);
  pending.current = value;
  useEffect(() => {
    if (value === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = value;
      updatePage(page.id, { title: value });
      document.title = value || "Atrium";
    }, 300);
    return () => clearTimeout(t);
  }, [value, page.id]);

  // Ao sair da página antes do salvamento atrasado, salva o título na hora.
  useEffect(
    () => () => {
      if (pending.current !== lastSaved.current) updatePage(page.id, { title: pending.current });
    },
    [page.id],
  );

  return (
    <textarea
      ref={ref}
      className="page-title"
      rows={1}
      placeholder="Sem título"
      value={value}
      autoFocus={!page.title && page.content.length === 0}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

export function PageHeader({ page, editable, onTitleEnter }: { page: Page; editable: boolean; onTitleEnter?: () => void }) {
  const [iconAnchor, setIconAnchor] = useState<Anchor | null>(null);
  const [coverAnchor, setCoverAnchor] = useState<Anchor | null>(null);
  const resolvedCover = useResolvedUrl(page.cover && !page.cover.startsWith("linear") && !page.cover.startsWith("#") ? page.cover : null);

  useEffect(() => {
    document.title = page.title || "Atrium";
    return () => {
      document.title = "Atrium";
    };
  }, [page.title]);

  return (
    <>
      {page.cover && (
        <div className="cover" style={coverStyle(page.cover, resolvedCover)}>
          {editable && (
            <div className="cover-actions">
              <button className="chip-btn" onClick={(e) => setCoverAnchor(e.currentTarget)}>
                Trocar capa
              </button>
            </div>
          )}
        </div>
      )}
      <div className={`page${page.fullWidth ? " full-width" : ""}`} style={{ paddingBottom: 0 }}>
        <div className={`page-header${page.cover ? " has-cover" : ""}`}>
          {page.icon && (
            <div className="page-icon" onClick={(e) => editable && setIconAnchor(e.currentTarget)}>
              {page.icon}
            </div>
          )}
          {editable && (
            <div className="header-controls">
              {!page.icon && (
                <button
                  className="ghost-btn"
                  onClick={() => updatePage(page.id, { icon: RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)] })}
                >
                  ☺ Adicionar ícone
                </button>
              )}
              {!page.cover && (
                <button className="ghost-btn" onClick={(e) => setCoverAnchor(e.currentTarget)}>
                  🖼 Adicionar capa
                </button>
              )}
            </div>
          )}
          {editable ? <TitleInput page={page} onEnter={onTitleEnter} /> : <h1 className="page-title">{page.title || "Sem título"}</h1>}
        </div>
      </div>
      {iconAnchor && (
        <EmojiPicker
          anchor={iconAnchor}
          onClose={() => setIconAnchor(null)}
          onPick={(icon) => updatePage(page.id, { icon })}
          onRemove={() => updatePage(page.id, { icon: "" })}
        />
      )}
      {coverAnchor && <CoverPicker page={page} anchor={coverAnchor} onClose={() => setCoverAnchor(null)} />}
    </>
  );
}
