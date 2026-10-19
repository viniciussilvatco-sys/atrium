import { useState } from "react";
import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { EmojiPicker } from "../../components/EmojiPicker";

function EmojiButton({ emoji, editable, onPick }: { emoji: string; editable: boolean; onPick: (e: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <span className="callout-emoji" contentEditable={false} onClick={(e) => editable && setAnchor(e.currentTarget)}>
        {emoji}
      </span>
      {anchor && <EmojiPicker anchor={anchor} onClose={() => setAnchor(null)} onPick={onPick} />}
    </>
  );
}

export const createCallout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      backgroundColor: defaultProps.backgroundColor,
      textColor: defaultProps.textColor,
      emoji: { default: "💡" },
    },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => (
      <div className="callout">
        <EmojiButton
          emoji={block.props.emoji}
          editable={editor.isEditable}
          onPick={(emoji) => editor.updateBlock(block, { props: { emoji } })}
        />
        <div className="callout-body" ref={contentRef} />
      </div>
    ),
  },
);
