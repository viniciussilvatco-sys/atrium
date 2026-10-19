import { useState } from "react";
import type { Page, PropDef, SelectOption } from "../db/types";
import { Popover, type Anchor } from "../components/ui";
import { addOption, deleteOption, setRowProp, updateOption } from "./actions";
import { TAG_COLORS, formatDateValue } from "./query";

export function Tag({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span className={`tag tag-${option.color}`}>
      {option.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ opacity: 0.6 }}
        >
          ✕
        </button>
      )}
    </span>
  );
}

const COLOR_NAMES: Record<string, string> = {
  gray: "Cinza",
  brown: "Marrom",
  orange: "Laranja",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  purple: "Roxo",
  pink: "Rosa",
  red: "Vermelho",
};

function OptionEditor({ dbId, def, option, anchor, onClose }: { dbId: string; def: PropDef; option: SelectOption; anchor: Anchor; onClose: () => void }) {
  const [name, setName] = useState(option.name);
  return (
    <Popover anchor={anchor} onClose={onClose} width={220}>
      <input
        className="input"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== option.name && updateOption(dbId, def.id, option.id, { name: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (name.trim()) updateOption(dbId, def.id, option.id, { name: name.trim() });
            onClose();
          }
        }}
      />
      <button
        className="menu-item danger"
        onClick={() => {
          deleteOption(dbId, def.id, option.id);
          onClose();
        }}
      >
        <span className="mi-icon">🗑</span> Excluir opção
      </button>
      <div className="menu-label">Cor</div>
      {TAG_COLORS.map((c) => (
        <button key={c} className={`menu-item${c === option.color ? " selected" : ""}`} onClick={() => updateOption(dbId, def.id, option.id, { color: c })}>
          <span className={`tag tag-${c}`} style={{ width: 16, height: 16, padding: 0 }} />
          {COLOR_NAMES[c]}
        </button>
      ))}
    </Popover>
  );
}

function SelectEditor({ dbId, def, row, anchor, onClose }: { dbId: string; def: PropDef; row: Page; anchor: Anchor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ option: SelectOption; anchor: HTMLElement } | null>(null);
  const multi = def.type === "multiselect";
  const raw = row.properties?.[def.id];
  const selected: string[] = multi ? (Array.isArray(raw) ? (raw as string[]) : []) : raw ? [raw as string] : [];
  const options = def.options ?? [];
  const q = query.trim().toLowerCase();
  const visible = options.filter((o) => !q || o.name.toLowerCase().includes(q));
  const exact = options.some((o) => o.name.toLowerCase() === q);

  const toggle = (id: string) => {
    if (multi) setRowProp(row.id, def.id, selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    else {
      setRowProp(row.id, def.id, selected[0] === id ? undefined : id);
      onClose();
    }
  };

  const create = async () => {
    if (!q) return;
    const id = await addOption(dbId, def.id, query.trim());
    setQuery("");
    if (multi) setRowProp(row.id, def.id, [...selected, id]);
    else {
      setRowProp(row.id, def.id, id);
      onClose();
    }
  };

  return (
    <Popover anchor={anchor} onClose={() => !editing && onClose()} width={260}>
      <div className="row" style={{ padding: 4, gap: 4 }}>
        {selected.map((id) => {
          const o = options.find((x) => x.id === id);
          return o ? <Tag key={id} option={o} onRemove={() => toggle(id)} /> : null;
        })}
      </div>
      <input
        className="input"
        autoFocus
        placeholder={def.type === "status" ? "Buscar status…" : "Buscar ou criar opção…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (visible.length === 1 && q) toggle(visible[0].id);
            else if (!exact) create();
          }
        }}
      />
      <div className="menu-label">{multi ? "Selecione uma ou mais opções" : "Selecione uma opção"}</div>
      {visible.map((o) => (
        <div key={o.id} className={`menu-item${selected.includes(o.id) ? " selected" : ""}`} onClick={() => toggle(o.id)} style={{ cursor: "pointer" }}>
          <Tag option={o} />
          <button
            className="icon-btn"
            style={{ marginLeft: "auto" }}
            onClick={(e) => {
              e.stopPropagation();
              setEditing({ option: o, anchor: e.currentTarget });
            }}
          >
            ⋯
          </button>
        </div>
      ))}
      {q && !exact && (
        <button className="menu-item" onClick={create}>
          <span className="mi-icon">＋</span> Criar <Tag option={{ id: "", name: query.trim(), color: TAG_COLORS[options.length % TAG_COLORS.length] }} />
        </button>
      )}
      {editing && (
        <OptionEditor dbId={dbId} def={def} option={editing.option} anchor={editing.anchor} onClose={() => setEditing(null)} />
      )}
    </Popover>
  );
}

/** Exibe e edita o valor de uma propriedade de uma linha. */
export function PropertyCell({ dbId, def, row, compact }: { dbId: string; def: PropDef; row: Page; compact?: boolean }) {
  const value = row.properties?.[def.id];
  const [editing, setEditing] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  switch (def.type) {
    case "checkbox":
      return (
        <div className="cell" style={{ minWidth: compact ? 0 : 80 }}>
          <input type="checkbox" checked={value === true} onChange={(e) => setRowProp(row.id, def.id, e.target.checked)} style={{ width: 16, height: 16 }} />
        </div>
      );

    case "select":
    case "status":
    case "multiselect": {
      const ids: string[] = def.type === "multiselect" ? (Array.isArray(value) ? (value as string[]) : []) : value ? [value as string] : [];
      return (
        <div className="cell" onClick={(e) => setAnchor(e.currentTarget)}>
          {ids.map((id) => {
            const o = def.options?.find((x) => x.id === id);
            return o ? <Tag key={id} option={o} /> : null;
          })}
          {!ids.length && compact && <span className="faint">Vazio</span>}
          {anchor && <SelectEditor dbId={dbId} def={def} row={row} anchor={anchor} onClose={() => setAnchor(null)} />}
        </div>
      );
    }

    case "date":
      if (editing)
        return (
          <div className="cell">
            <input
              className="cell-input"
              type="date"
              autoFocus
              defaultValue={typeof value === "string" ? value : ""}
              onChange={(e) => setRowProp(row.id, def.id, e.target.value || undefined)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditing(false)}
            />
          </div>
        );
      return (
        <div className="cell" onClick={() => setEditing(true)}>
          {typeof value === "string" && value ? formatDateValue(value) : compact ? <span className="faint">Vazio</span> : null}
        </div>
      );

    default: {
      // text, number, url
      if (editing)
        return (
          <div className="cell">
            <input
              className="cell-input"
              autoFocus
              type={def.type === "number" ? "number" : "text"}
              inputMode={def.type === "number" ? "decimal" : undefined}
              defaultValue={value === undefined || value === null ? "" : String(value)}
              onBlur={(e) => {
                const v = e.target.value;
                const next = v === "" ? undefined : def.type === "number" ? Number(v) : v;
                if (next !== value) setRowProp(row.id, def.id, next);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          </div>
        );
      const text = value === undefined || value === null ? "" : String(value);
      return (
        <div className="cell" onClick={() => setEditing(true)} style={def.type === "number" ? { justifyContent: "flex-end" } : undefined}>
          {def.type === "url" && text ? (
            <a href={/^https?:\/\//.test(text) ? text : `https://${text}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {text}
            </a>
          ) : text ? (
            text
          ) : compact ? (
            <span className="faint">Vazio</span>
          ) : null}
        </div>
      );
    }
  }
}
