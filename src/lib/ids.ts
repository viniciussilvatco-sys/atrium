export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID().replace(/-/g, "");
    } catch {
      // randomUUID exige contexto seguro (https/localhost); cai no fallback abaixo
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

let cachedDeviceId: string | null = null;

/** Identificador estável deste dispositivo/navegador, usado para desempatar conflitos. */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let id = localStorage.getItem("atrium.deviceId");
    if (!id) {
      id = newId();
      localStorage.setItem("atrium.deviceId", id);
    }
    cachedDeviceId = id;
  } catch {
    cachedDeviceId = newId();
  }
  return cachedDeviceId;
}
