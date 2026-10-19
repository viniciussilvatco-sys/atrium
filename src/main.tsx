import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/theme.css";
import "./lib/install";
import App from "./App";
import { purgeOldTrash } from "./db/repo";
import { startSyncEngine } from "./sync/syncEngine";
import { effectiveThemeStore } from "./lib/store";

// Aplica o tema antes do primeiro desenho para evitar "piscar".
document.documentElement.dataset.theme = effectiveThemeStore.get();

registerSW({ immediate: true });

// Pede ao navegador para não apagar os dados locais sob pouco espaço.
navigator.storage?.persisted?.().then((p) => {
  if (!p) navigator.storage.persist?.().catch(() => {});
});

purgeOldTrash().catch(() => {});
startSyncEngine();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
