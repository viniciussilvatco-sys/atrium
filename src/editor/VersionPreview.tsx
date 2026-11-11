import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { schema, type AtriumPartialBlock } from "./schema";
import { resolveAssetUrl } from "./assets";
import { effectiveThemeStore, useStore } from "../lib/store";

/** Mostra o conteúdo de uma versão antiga, só para leitura (usado no histórico de versões). */
export function VersionPreview({ content }: { content: unknown[] }) {
  const theme = useStore(effectiveThemeStore);
  const editor = useCreateBlockNote({
    schema,
    initialContent: content?.length ? (content as AtriumPartialBlock[]) : undefined,
    resolveFileUrl: resolveAssetUrl,
  });
  return <BlockNoteView editor={editor} theme={theme} editable={false} slashMenu={false} sideMenu={false} formattingToolbar={false} />;
}
