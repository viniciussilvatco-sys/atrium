import { useState } from "react";
import type { Profile } from "../db/types";
import { createProfile, deleteProfile, PROFILE_COLORS, updateProfile } from "../db/repo";
import { currentProfileStore, navigate } from "../lib/store";
import { Modal, Popover, confirmAction, type Anchor } from "./ui";
import { EmojiPicker } from "./EmojiPicker";

export function ProfileBadge({ profile, size = 24 }: { profile: Pick<Profile, "icon" | "color">; size?: number }) {
  return (
    <span className="profile-badge" style={{ background: profile.color + "33", width: size, height: size, fontSize: size * 0.6 }}>
      {profile.icon}
    </span>
  );
}

function ProfileEditor({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [icon, setIcon] = useState(profile?.icon ?? "📁");
  const [color, setColor] = useState(profile?.color ?? PROFILE_COLORS[1]);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);

  const save = async () => {
    if (!name.trim()) return;
    if (profile) await updateProfile(profile.id, { name: name.trim(), icon, color });
    else {
      const p = await createProfile(name.trim(), icon, color);
      currentProfileStore.set(p.id);
      navigate(null);
    }
    onClose();
  };

  return (
    <Modal title={profile ? "Editar perfil" : "Novo perfil"} onClose={onClose}>
      <p className="faint" style={{ marginTop: 0 }}>
        Perfis são espaços separados, cada um com suas próprias páginas — por exemplo: Estudo, Trabalho, Pessoal.
      </p>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <button className="btn" style={{ fontSize: 20, padding: "2px 10px" }} onClick={(e) => setEmojiAnchor(e.currentTarget)}>
          {icon}
        </button>
        <input
          className="input"
          autoFocus
          placeholder="Nome do perfil (ex.: Estudo)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {PROFILE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Cor ${c}`}
            style={{ width: 24, height: 24, borderRadius: 12, background: c, outline: c === color ? "2px solid var(--text)" : "none", outlineOffset: 2 }}
          />
        ))}
      </div>
      <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>
          {profile ? "Salvar" : "Criar perfil"}
        </button>
      </div>
      {emojiAnchor && <EmojiPicker anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onPick={setIcon} />}
    </Modal>
  );
}

export function ProfileSwitcher({ profiles, current }: { profiles: Profile[]; current: Profile | undefined }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [editing, setEditing] = useState<Profile | null | "new">(null);

  return (
    <>
      <div className="profile-switch" onClick={(e) => setAnchor(e.currentTarget)}>
        {current ? <ProfileBadge profile={current} /> : null}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.name ?? "Atrium"}</span>
        <span className="faint">⇅</span>
      </div>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={260}>
          <div className="menu-label">Perfis</div>
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`menu-item${p.id === current?.id ? " selected" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => {
                currentProfileStore.set(p.id);
                navigate(null);
                setAnchor(null);
              }}
            >
              <ProfileBadge profile={p} size={22} />
              <span style={{ flex: 1 }}>{p.name}</span>
              {p.id === current?.id && <span>✓</span>}
              <button
                className="icon-btn"
                title="Editar perfil"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchor(null);
                  setEditing(p);
                }}
              >
                ✎
              </button>
            </div>
          ))}
          <div className="menu-sep" />
          <button
            className="menu-item"
            onClick={() => {
              setAnchor(null);
              setEditing("new");
            }}
          >
            <span className="mi-icon">＋</span> Novo perfil
          </button>
          {current && profiles.length > 1 && (
            <button
              className="menu-item danger"
              onClick={async () => {
                setAnchor(null);
                if (!confirmAction(`Excluir o perfil "${current.name}" e TODAS as suas páginas? Isso não pode ser desfeito.`)) return;
                await deleteProfile(current.id);
                const next = profiles.find((p) => p.id !== current.id);
                currentProfileStore.set(next?.id ?? null);
                navigate(null);
              }}
            >
              <span className="mi-icon">🗑</span> Excluir perfil atual
            </button>
          )}
        </Popover>
      )}
      {editing && <ProfileEditor profile={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
