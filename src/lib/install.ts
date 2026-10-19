import { createStore } from "./store";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Guarda o evento de instalação do PWA para oferecer o botão "Instalar" nas configurações. */
export const installPrompt = createStore<BeforeInstallPromptEvent | null>(null);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt.set(e as BeforeInstallPromptEvent);
});
window.addEventListener("appinstalled", () => installPrompt.set(null));
