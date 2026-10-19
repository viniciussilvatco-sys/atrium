import { describe, expect, it } from "vitest";
import { toEmbedUrl } from "./embed";

describe("toEmbedUrl", () => {
  it("converte links do YouTube", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtube.com/shorts/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(toEmbedUrl("https://m.youtube.com/watch?v=abc&t=42s")).toBe("https://www.youtube-nocookie.com/embed/abc?start=42");
  });
  it("converte Vimeo e Spotify", () => {
    expect(toEmbedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
    expect(toEmbedUrl("https://open.spotify.com/track/xyz")).toBe("https://open.spotify.com/embed/track/xyz");
  });
  it("converte documentos do Google para visualização", () => {
    expect(toEmbedUrl("https://docs.google.com/document/d/ID/edit")).toBe("https://docs.google.com/document/d/ID/preview");
  });
  it("retorna null para sites desconhecidos ou texto inválido", () => {
    expect(toEmbedUrl("https://exemplo.com/artigo")).toBeNull();
    expect(toEmbedUrl("não é url")).toBeNull();
  });
});
