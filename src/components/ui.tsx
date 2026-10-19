import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Emitter } from "../lib/events";

// ---------- Popover ancorado a um elemento ou ponto ----------

export type Anchor = HTMLElement | DOMRect | { x: number; y: number };

function anchorRect(a: Anchor): DOMRect {
  if (a instanceof HTMLElement) return a.getBoundingClientRect();
  if ("width" in a) return a;
  return new DOMRect(a.x, a.y, 0, 0);
}

export function Popover({
  anchor,
  onClose,
  children,
  width,
  align = "start",
}: {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = anchorRect(anchor);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === "end" ? r.right - w : r.left;
    let top = r.bottom + 4;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ left, top });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Adia o registro para não fechar com o mesmo clique que abriu.
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    });
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="popover"
      style={{ left: pos.left, top: pos.top, width }}
      onContextMenu={(e) => e.preventDefault()}
      // O portal ainda propaga eventos pela árvore React; não deixamos vazar para o elemento-âncora.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface MenuEntry {
  label?: string;
  icon?: ReactNode;
  hint?: string;
  danger?: boolean;
  onClick?: () => void;
  separator?: boolean;
  heading?: string;
  hidden?: boolean;
}

export function Menu({ anchor, items, onClose, align }: { anchor: Anchor; items: MenuEntry[]; onClose: () => void; align?: "start" | "end" }) {
  return (
    <Popover anchor={anchor} onClose={onClose} align={align}>
      {items
        .filter((i) => !i.hidden)
        .map((item, idx) => {
          if (item.separator) return <div key={idx} className="menu-sep" />;
          if (item.heading) return <div key={idx} className="menu-label">{item.heading}</div>;
          return (
            <button
              key={idx}
              className={`menu-item${item.danger ? " danger" : ""}`}
              onClick={() => {
                onClose();
                item.onClick?.();
              }}
            >
              <span className="mi-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.hint && <span className="mi-hint">{item.hint}</span>}
            </button>
          );
        })}
    </Popover>
  );
}

/** Hook prático para menus: `open(e)` abre ancorado no elemento clicado. */
export function useMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  return {
    anchor,
    open: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setAnchor(e.type === "contextmenu" ? { x: e.clientX, y: e.clientY } : (e.currentTarget as HTMLElement));
    },
    close: () => setAnchor(null),
  };
}

// ---------- Modal ----------

export function Modal({
  title,
  onClose,
  children,
  wide,
  bare,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog">
        {!bare && (
          <div className="modal-head">
            <span>{title}</span>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          </div>
        )}
        {bare ? children : <div className="modal-body">{children}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Toast ----------

const toasts = new Emitter<string>();

export function toast(message: string) {
  toasts.emit(message);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = toasts.on((m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 3200);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return msg ? createPortal(<div className="toast">{msg}</div>, document.body) : null;
}

// ---------- Confirmação ----------

export function confirmAction(message: string): boolean {
  return window.confirm(message);
}

// ---------- Utilidades ----------

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return formatDate(ts);
}

export function pageTitle(p: { title: string } | undefined | null): string {
  return p?.title?.trim() || "Sem título";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
