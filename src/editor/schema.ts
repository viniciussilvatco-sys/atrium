import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { createCallout } from "./blocks/Callout";
import { createMathBlock } from "./blocks/MathBlock";
import { createEmbed } from "./blocks/Embed";
import { createPdfBlock } from "./blocks/PdfBlock";
import { createDatabaseBlock, createSubpageBlock, pageLinkSpec } from "./blocks/PageBlocks";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({ ...codeBlockOptions, defaultLanguage: "text" }),
    callout: createCallout(),
    math: createMathBlock(),
    embed: createEmbed(),
    pdf: createPdfBlock(),
    subpage: createSubpageBlock(),
    database: createDatabaseBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    pageLink: pageLinkSpec,
  },
});

export type AtriumEditor = typeof schema.BlockNoteEditor;
export type AtriumBlock = typeof schema.Block;
export type AtriumPartialBlock = typeof schema.PartialBlock;
