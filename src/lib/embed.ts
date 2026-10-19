/** Converte links comuns (YouTube, Vimeo, Spotify, Google Maps/Docs…) em URLs incorporáveis. */
export function toEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = url.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([\w-]+)/.exec(url.pathname)?.[1];
    if (id) {
      const start = url.searchParams.get("t");
      return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${parseInt(start, 10)}` : ""}`;
    }
    const list = url.searchParams.get("list");
    if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "vimeo.com") {
    const id = /^\/(\d+)/.exec(url.pathname)?.[1];
    if (id) return `https://player.vimeo.com/video/${id}`;
  }
  if (host === "open.spotify.com" && !url.pathname.startsWith("/embed")) {
    return `https://open.spotify.com/embed${url.pathname}`;
  }
  if (host === "loom.com" && url.pathname.startsWith("/share/")) {
    return `https://www.loom.com/embed/${url.pathname.slice(7)}`;
  }
  if (host === "docs.google.com" && /\/(document|spreadsheets|presentation)\//.test(url.pathname)) {
    return raw.replace(/\/(edit|view)([?#].*)?$/, "/preview");
  }
  if (host === "drive.google.com" && /\/file\/d\//.test(url.pathname)) {
    return raw.replace(/\/(view|edit)([?#].*)?$/, "/preview");
  }
  if (host === "google.com" && url.pathname.startsWith("/maps")) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-1)[0] ?? "")}&output=embed`;
  }
  if (host === "figma.com") {
    return `https://www.figma.com/embed?embed_host=atrium&url=${encodeURIComponent(raw)}`;
  }
  if (host === "codepen.io" && url.pathname.includes("/pen/")) {
    return raw.replace("/pen/", "/embed/");
  }
  return null;
}
