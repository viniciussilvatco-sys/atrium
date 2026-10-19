import { useState } from "react";
import { db } from "../db/schema";
import { seedDefaults } from "../db/repo";
import { connect, getClientId, setClientId } from "../sync/googleAuth";
import { syncNow } from "../sync/syncEngine";
import { currentProfileStore, onboardedStore } from "../lib/store";

/** Primeira abertura: começar do zero ou trazer os dados de outro aparelho pelo Drive. */
export function Welcome() {
  const [step, setStep] = useState<"choose" | "connect" | "syncing">("choose");
  const [clientId, setClientIdInput] = useState(getClientId());
  const [error, setError] = useState<string | null>(null);

  const startFresh = async () => {
    const first = await seedDefaults();
    currentProfileStore.set(first.id);
    onboardedStore.set(true);
  };

  const connectAndSync = async () => {
    setError(null);
    try {
      if (clientId !== getClientId()) setClientId(clientId);
      await connect();
      setStep("syncing");
      await syncNow();
      const profiles = (await db.profiles.toArray()).filter((p) => !p.deleted);
      if (!profiles.length) {
        // Drive vazio: cria os perfis iniciais, que serão enviados na próxima sincronização.
        await startFresh();
        syncNow();
        return;
      }
      currentProfileStore.set(profiles.sort((a, b) => a.order - b.order)[0].id);
      onboardedStore.set(true);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === "popup_blocked" ? "O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo." : msg);
      setStep("connect");
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-card">
        <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} width={72} height={72} alt="" />
        <h1>Bem-vindo ao Atrium</h1>
        <p>Seu caderno de anotações com páginas, bancos de dados e perfis separados para estudo, trabalho e o que mais quiser.</p>

        {step === "choose" && (
          <div className="welcome-actions">
            <button className="btn primary" onClick={startFresh}>
              ✨ Começar do zero
            </button>
            <button className="btn" onClick={() => setStep("connect")}>
              ☁️ Já uso em outro aparelho — trazer do Google Drive
            </button>
          </div>
        )}

        {step === "connect" && (
          <div className="welcome-actions">
            {!getClientId() && (
              <>
                <p style={{ fontSize: 13, margin: 0 }}>
                  Cole o <b>ID do cliente Google</b> (veja o guia <i>docs/CONFIGURAR-GOOGLE.md</i>):
                </p>
                <input
                  className="input"
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientIdInput(e.target.value)}
                />
              </>
            )}
            <button className="btn primary" onClick={connectAndSync} disabled={!clientId.trim()}>
              Entrar com Google e sincronizar
            </button>
            <button className="btn" onClick={() => setStep("choose")}>
              Voltar
            </button>
            {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          </div>
        )}

        {step === "syncing" && <p>⟳ Baixando suas páginas do Google Drive…</p>}
      </div>
    </div>
  );
}
