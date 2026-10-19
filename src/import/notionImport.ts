// Importa o ZIP de exportação do Notion ("Markdown & CSV") para um perfil do Atrium.

import JSZip from "jszip";
import { BlockNoteEditor } from "@blocknote/core";
import { schema } from "../editor/schema";
import { storeFile, assetIdOf } from "../editor/assets";
import { createPage, updatePage } from "../db/repo";
import { newId } from "../lib/ids";
import {
  NOTION_URL,
  basename,
  buildParents,
  csvToMarkdownTable,
  dirname,
  localLinks,
  parseNotionName,
  postprocessBlocks,
  preprocessNotionMarkdown,
  resolvePath,
  safeDecode,
  type LinkTarget,
} from "./notionParse";

export interface ImportResult {
  rootPageId: string;
  pages: number;
  files: number;
  warnings: string[];
}

type Progress = (message: string) => void;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i;
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  txt: "text/plain",
};

function mimeOf(name: string) {
  return MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Abre o ZIP (incluindo ZIPs dentro do ZIP, como o Notion faz em exportações grandes). */
async function readEntries(file: Blob, onProgress: Progress): Promise<Map<string, JSZip.JSZipObject>> {
  const entries = new Map<string, JSZip.JSZipObject>();
  const visit = async (blob: Blob | ArrayBuffer, prefix: string) => {
    const zip = await JSZip.loadAsync(blob);
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name.startsWith("__MACOSX/") || basename(entry.name).startsWith(".")) continue;
      if (/\.zip$/i.test(entry.name)) {
        onProgress(`Abrindo ${basename(entry.name)}…`);
        await visit(await entry.async("arraybuffer"), prefix);
      } else entries.set(prefix + entry.name, entry);
    }
  };
  await visit(file, "");
  return entries;
}

export async function importNotionZip(file: File, profileId: string, onProgress: Progress = () => {}): Promise<ImportResult> {
  onProgress("Lendo o arquivo…");
  const entries = await readEntries(file, onProgress);
  const pagePaths = [...entries.keys()].filter((p) => /\.(md|csv)$/i.test(p));
  if (!pagePaths.length) throw new Error("Não encontrei páginas neste ZIP. Exporte do Notion no formato “Markdown & CSV”.");

  // Ids definidos antes, para que os links entre páginas possam ser resolvidos.
  const pageIds = new Map(pagePaths.map((p) => [p, newId()]));
  const byNotionId = new Map<string, string>();
  for (const p of pagePaths) {
    const m = /([0-9a-f]{32})\.(md|csv)$/i.exec(p);
    if (m) byNotionId.set(m[1].toLowerCase(), pageIds.get(p)!);
  }
  const parents = buildParents(pagePaths);
  const titles = new Map(pagePaths.map((p) => [p, parseNotionName(basename(p)).title]));
  const warnings: string[] = [];

  const root = await createPage({
    profileId,
    title: `Importado do Notion (${new Date().toLocaleDateString("pt-BR")})`,
    icon: "📥",
  });

  // 1) Envia os arquivos (imagens, PDFs…) referenciados pelas páginas.
  const assetByPath = new Map<string, { id: string; name: string; mime: string }>();
  const texts = new Map<string, string>();
  for (const p of pagePaths) texts.set(p, await entries.get(p)!.async("string"));

  const toUpload: { path: string; pageId: string }[] = [];
  for (const p of pagePaths) {
    if (!p.toLowerCase().endsWith(".md")) continue;
    for (const link of localLinks(texts.get(p)!)) {
      const path = resolvePath(dirname(p), safeDecode(link.href));
      if (entries.has(path) && !/\.(md|csv)$/i.test(path) && !toUpload.some((u) => u.path === path)) toUpload.push({ path, pageId: pageIds.get(p)! });
    }
  }
  let n = 0;
  for (const { path, pageId } of toUpload) {
    onProgress(`Enviando arquivos ${++n}/${toUpload.length}…`);
    try {
      const name = basename(path);
      const blob = await entries.get(path)!.async("blob");
      const url = await storeFile(new File([blob], name, { type: mimeOf(name) }), profileId, pageId);
      assetByPath.set(path, { id: assetIdOf(url)!, name, mime: mimeOf(name) });
    } catch (e) {
      warnings.push(`Não foi possível importar o arquivo “${basename(path)}”: ${(e as Error).message}`);
    }
  }

  // 2) Converte cada página.
  const editor = BlockNoteEditor.create({ schema });
  const childOrder = new Map<string, number>(); // ordem das subpáginas conforme aparecem no texto do pai
  const contents = new Map<string, unknown[]>();

  n = 0;
  for (const p of pagePaths) {
    onProgress(`Convertendo páginas ${++n}/${pagePaths.length}…`);
    const dir = dirname(p);
    let markdown: string;
    let callouts: { emoji: string; text: string }[] = [];
    let maths: string[] = [];

    if (p.toLowerCase().endsWith(".csv")) {
      markdown = csvToMarkdownTable(texts.get(p)!);
    } else {
      const pre = preprocessNotionMarkdown(texts.get(p)!, (href, isImage): LinkTarget | null => {
        const notion = NOTION_URL.exec(href);
        if (notion) {
          const target = byNotionId.get(notion[1].toLowerCase());
          return target ? { kind: "page", id: target } : null;
        }
        const path = resolvePath(dir, safeDecode(href));
        const pageId = pageIds.get(path);
        if (pageId) return { kind: "page", id: pageId };
        const asset = assetByPath.get(path);
        if (!asset) return null;
        if (isImage || IMAGE_EXT.test(path)) return { kind: "image", id: asset.id };
        return { kind: "file", id: asset.id, name: asset.name };
      });
      if (pre.title) titles.set(p, pre.title);
      markdown = pre.markdown;
      callouts = pre.callouts;
      maths = pre.maths;
    }

    let blocks: unknown[] = [];
    try {
      blocks = markdown ? (editor.tryParseMarkdownToBlocks(markdown) as unknown[]) : [];
    } catch (e) {
      warnings.push(`Página “${titles.get(p)}” importada só como texto: ${(e as Error).message}`);
      blocks = [{ type: "paragraph", content: [{ type: "text", text: markdown, styles: {} }] }];
    }

    // Ordem das subpáginas = ordem em que os links aparecem no texto do pai.
    let pos = 0;
    for (const m of markdown.matchAll(/atrium\.local\/page\/([0-9a-f]+)/g)) if (!childOrder.has(m[1])) childOrder.set(m[1], pos++);

    const assetsById = new Map([...assetByPath.values()].map((a) => [a.id, a]));
    contents.set(
      p,
      postprocessBlocks(blocks as never, {
        pageTitle: (pid) => titles.get(pagePaths.find((x) => pageIds.get(x) === pid) ?? "") ?? "Página",
        isChild: (pid) => {
          const childPath = pagePaths.find((x) => pageIds.get(x) === pid);
          return !!childPath && parents.get(childPath) === p;
        },
        assetName: (aid) => assetsById.get(aid)?.name ?? "arquivo",
        assetIsPdf: (aid) => assetsById.get(aid)?.mime === "application/pdf",
        callouts,
        maths,
        calloutInline: (text) => {
          if (!text) return [];
          const parsed = editor.tryParseMarkdownToBlocks(text) as { content?: unknown }[];
          return (Array.isArray(parsed[0]?.content) ? parsed[0].content : []) as never;
        },
      }),
    );
  }

  // 3) Grava as páginas no Atrium.
  const topLevel: string[] = [];
  n = 0;
  for (const p of pagePaths) {
    onProgress(`Salvando ${++n}/${pagePaths.length}…`);
    const parentPath = parents.get(p);
    const id = pageIds.get(p)!;
    if (!parentPath) topLevel.push(p);
    await createPage({
      id,
      profileId,
      parentId: parentPath ? pageIds.get(parentPath)! : root.id,
      title: titles.get(p)!,
      icon: p.toLowerCase().endsWith(".csv") ? "🗂️" : "",
      content: contents.get(p) ?? [],
      order: childOrder.get(id) ?? 10_000 + n,
    });
  }

  // A página raiz lista as páginas de primeiro nível.
  topLevel.sort((a, b) => titles.get(a)!.localeCompare(titles.get(b)!, "pt-BR"));
  await updatePage(root.id, {
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: `${pagePaths.length} páginas importadas do Notion. Arraste-as na barra lateral para onde quiser.`, styles: {} }],
      },
      ...topLevel.map((p) => ({ type: "subpage", props: { pageId: pageIds.get(p)! } })),
    ],
  });
  for (const [i, p] of topLevel.entries()) await updatePage(pageIds.get(p)!, { order: i });

  return { rootPageId: root.id, pages: pagePaths.length, files: assetByPath.size, warnings };
}
