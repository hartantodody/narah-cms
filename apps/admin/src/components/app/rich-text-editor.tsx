import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  EditorContent,
  useEditor,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AssetPicker } from "@/features/media-assets/asset-picker";
import type { MediaAsset } from "@/features/media-assets/media-asset.types";
import { cn } from "@/lib/utils";

/**
 * RichTextEditor — TipTap-based editor that emits a TipTap JSON document.
 *
 * Stored value shape:  { type: "doc", content: [ ... ] }
 * Empty doc:           { type: "doc", content: [{ type: "paragraph" }] }
 */
export type TipTapDoc = JSONContent;

const EMPTY_DOC: TipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const isTipTapDoc = (value: unknown): value is TipTapDoc =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "doc";

export function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder,
  siteId,
}: {
  value: unknown;
  onChange: (next: TipTapDoc) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Optional — enables the image button + asset picker when provided. */
  siteId?: string;
}) {
  const initialContent: TipTapDoc = isTipTapDoc(value) ? value : EMPTY_DOC;
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing…",
      }),
      Typography,
      Image.configure({
        HTMLAttributes: {
          class: "narah-prose-image",
        },
        inline: false,
        allowBase64: false,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "narah-prose focus:outline-none min-h-[180px] px-4 py-3 text-sm",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as TipTapDoc);
    },
  });

  // Keep editor editable state in sync when `disabled` prop flips.
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const handleInsertImage = (asset: MediaAsset) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: asset.url,
        alt: asset.altText ?? asset.filename,
      })
      .run();
  };

  if (!editor) {
    return (
      <div className="h-48 animate-pulse rounded-lg border border-border bg-muted/40" />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
        <Toolbar
          editor={editor}
          disabled={disabled}
          canInsertImage={Boolean(siteId)}
          onInsertImage={() => setImagePickerOpen(true)}
        />
        <EditorContent editor={editor} />
      </div>
      {siteId ? (
        <AssetPicker
          open={imagePickerOpen}
          onOpenChange={setImagePickerOpen}
          siteId={siteId}
          onSelect={handleInsertImage}
          mimeTypePrefix="image/"
        />
      ) : null}
    </>
  );
}

/* ────────────────────────── Toolbar ────────────────────────── */

function Toolbar({
  editor,
  disabled,
  canInsertImage,
  onInsertImage,
}: {
  editor: Editor;
  disabled?: boolean;
  canInsertImage?: boolean;
  onInsertImage?: () => void;
}) {
  const handleAddLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5",
        disabled && "opacity-60 pointer-events-none",
      )}
    >
      <ToolbarGroup>
        <ToolbarButton
          icon={Bold}
          label="Bold"
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          isActive={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Code}
          label="Inline code"
          isActive={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          icon={Heading1}
          label="Heading 1"
          isActive={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          icon={Heading2}
          label="Heading 2"
          isActive={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={Heading3}
          label="Heading 3"
          isActive={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          icon={List}
          label="Bullet list"
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="Quote"
          isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={Minus}
          label="Divider"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </ToolbarGroup>

      <Divider />

      <ToolbarGroup>
        <ToolbarButton
          icon={LinkIcon}
          label="Link"
          isActive={editor.isActive("link")}
          onClick={handleAddLink}
        />
        {canInsertImage && onInsertImage ? (
          <ToolbarButton
            icon={ImageIcon}
            label="Insert image"
            onClick={onInsertImage}
          />
        ) : null}
      </ToolbarGroup>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton
          icon={Undo}
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={Redo}
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
    </div>
  );
}

const ToolbarGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-0.5">{children}</div>
);

const Divider = () => <span className="mx-1 h-5 w-px bg-border" />;

function ToolbarButton({
  icon: Icon,
  label,
  isActive,
  disabled,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        isActive && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
