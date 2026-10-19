import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Profile } from "../db/types";
import { db } from "../db/schema";
import { authChanges, connect, disconnect, getAuthState, getClientId, getConnectedEmail, setClientId } from "../sync/googleAuth";
import { getQuota } from "../sync/driveApi";
import { resetSyncState, syncNow } from "../sync/syncEngine";
import { exportBackup, exportProfile, importBackup } from "../export/exporter";
import { themeStore, useStore, type ThemePref } from "../lib/store";
import { installPrompt } from "../lib/install";
import { useSyncStatus } from "./Sidebar";
import { Modal, confirmAction, timeAgo, toast } from "./ui";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function GoogleSection() {
  const [auth, setAuth] = useState(getAuthState());
  const [busy, setBusy] = useState(false);
  const [clientId, setClientIdInput] = useState(getClientId());
  const [showAdvanced, setShowAdvanced] = useState(!getClientId());
  const [quota, setQuota] = useState<{ usage: number; limit: number } | null>(null);
  const status = useSyncStatus();

  useEffect(() => authChanges.on(setAuth), []);
  useEffect(() => {
    if (auth === "connected") getQuota().then(setQuota);
  }, [auth]);

  const doConnect = async () => {
    setBusy(true);
    try {
      await connect();
      toast("Google Drive conectado! Sincronizando…");
    } catch (e) {
      const msg = (e as Error).message;
      toast(msg === "popup_blocked" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site." : `Não foi possível conectar: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <h3>☁️ Sincronização com Google Drive</h3>
      <p>
        Suas páginas ficam numa pasta oculta e exclusiva do Atrium no seu Google Drive. Conecte a mesma conta Google em cada aparelho (PC, celular…)
        para manter tudo sincronizado. Sem conexão, tudo continua salvo neste aparelho.
      </p>
      {auth === "noClientId" ? (
        <p style={{ color: "var(--danger)" }}>
          Falta configurar o “ID do cliente” do Google (passo único). Siga o guia <b>docs/CONFIGURAR-GOOGLE.md</b> e cole o ID abaixo.
        </p>
      ) : auth === "disconnected" ? (
        <button className="btn primary" onClick={doConnect} disabled={busy}>
          {busy ? "Conectando…" : "Conectar Google Drive"}
        </button>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className={`sync-dot ${status.state}`} />
            <span>
              Conectado{getConnectedEmail() ? ` como ${getConnectedEmail()}` : ""}
              {status.lastSync ? ` · última sincronização ${timeAgo(status.lastSync)}` : ""}
            </span>
          </div>
          {status.error && <p style={{ color: "var(--danger)" }}>Erro: {status.error}</p>}
          {quota && quota.limit > 0 && (
            <p className="faint">
              Espaço no Google Drive: {fmtBytes(quota.usage)} de {fmtBytes(quota.limit)} usados
            </p>
          )}
          <div className="row">
            {auth === "needsReauth" && (
              <button className="btn primary" onClick={doConnect} disabled={busy}>
                Reconectar
              </button>
            )}
            <button className="btn" onClick={() => syncNow()} disabled={status.state === "syncing"}>
              ⟳ Sincronizar agora
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (!confirmAction("Desconectar o Google Drive neste aparelho? Seus dados locais continuam aqui e no Drive.")) return;
                disconnect();
                await resetSyncState();
              }}
            >
              Desconectar
            </button>
          </div>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <button className="ghost-btn" style={{ padding: "2px 0" }} onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? "▾" : "▸"} Avançado: ID do cliente Google
        </button>
        {showAdvanced && (
          <div className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}>
            <input
              className="input"
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientIdInput(e.target.value)}
            />
            <button
              className="btn"
              onClick={() => {
                setClientId(clientId);
                toast("ID do cliente salvo");
              }}
            >
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InstallSection() {
  const prompt = useStore(installPrompt);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return (
    <div className="settings-section">
      <h3>📲 Instalar o app</h3>
      {standalone ? (
        <p>O Atrium já está instalado neste aparelho. ✓</p>
      ) : prompt ? (
        <>
          <p>Instale o Atrium para abri-lo como um aplicativo, com ícone próprio e funcionando offline.</p>
          <button
            className="btn primary"
            onClick={async () => {
              await prompt.prompt();
              installPrompt.set(null);
            }}
          >
            Instalar Atrium
          </button>
        </>
      ) : (
        <p>
          <b>PC (Chrome/Edge):</b> clique no ícone de instalar na barra de endereço (⊕) ou no menu ⋮ → “Instalar Atrium”.
          <br />
          <b>Android (Chrome):</b> menu ⋮ → “Adicionar à tela inicial” / “Instalar app”.
          <br />
          <b>Mac (Safari):</b> Arquivo → “Adicionar ao Dock”.
        </p>
      )}
    </div>
  );
}

export function SettingsModal({ profile, onClose }: { profile: Profile | undefined; onClose: () => void }) {
  const theme = useStore(themeStore);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const stats = useLiveQuery(async () => {
    const pages = await db.pages.filter((p) => !p.deleted).count();
    const assets = await db.assets.filter((a) => !a.deleted).toArray();
    return { pages, assets: assets.length, bytes: assets.reduce((s, a) => s + (a.blob?.size ?? a.size ?? 0), 0) };
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Configurações" onClose={onClose}>
      <GoogleSection />

      <div className="settings-section">
        <h3>🎨 Aparência</h3>
        <div className="seg">
          {(
            [
              ["light", "☀️ Claro"],
              ["dark", "🌙 Escuro"],
              ["system", "💻 Sistema"],
            ] as [ThemePref, string][]
          ).map(([v, label]) => (
            <button key={v} className={theme === v ? "on" : ""} onClick={() => themeStore.set(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>📦 Exportar e backup</h3>
        <p>Exporte suas anotações em Markdown (abre em qualquer editor) ou faça um backup completo para restaurar depois.</p>
        <div className="row">
          {profile && (
            <button className="btn" disabled={!!busy} onClick={() => run("export", () => exportProfile(profile.id))}>
              {busy === "export" ? "Gerando…" : `Exportar “${profile.name}” (Markdown .zip)`}
            </button>
          )}
          <button className="btn" disabled={!!busy} onClick={() => run("backup", exportBackup)}>
            {busy === "backup" ? "Gerando…" : "Backup completo (.json)"}
          </button>
          <button className="btn" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            {busy === "import" ? "Importando…" : "Restaurar backup…"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f)
                run("import", async () => {
                  const n = await importBackup(f);
                  toast(`Backup restaurado: ${n} item(ns) atualizado(s)`);
                });
            }}
          />
        </div>
      </div>

      <InstallSection />

      <div className="settings-section">
        <h3>💾 Armazenamento neste aparelho</h3>
        {stats && (
          <p>
            {stats.pages} páginas · {stats.assets} arquivos ({fmtBytes(stats.bytes)})
          </p>
        )}
        <button
          className="btn"
          onClick={async () => {
            const ok = await navigator.storage?.persist?.();
            toast(ok ? "O navegador não apagará seus dados automaticamente." : "O navegador não permitiu (os dados continuam salvos normalmente).");
          }}
        >
          Proteger dados contra limpeza automática
        </button>
      </div>

      <div className="faint">Atrium 1.0 · seus dados ficam no seu aparelho e no seu Google Drive.</div>
    </Modal>
  );
}
