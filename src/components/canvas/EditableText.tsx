"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import type { TextElement, Theme } from "@/lib/deck/schema";
import { useDeckStore } from "@/store/deck-store";
import { textStyle } from "./tokens";

export type EditableTextProps = {
  element: TextElement;
  theme: Theme;
  slideId: string;
  /** Called after the edit is committed so the stage can take focus back. */
  onExit?: () => void;
};

const VALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;

/**
 * Inline Tiptap editor for one text element. Same typography as the static
 * view; commits the html through `updateElement` on blur or Escape.
 */
export function EditableText({ element, theme, slideId, onExit }: EditableTextProps) {
  const updateElement = useDeckStore((s) => s.updateElement);
  const setEditingElement = useDeckStore((s) => s.setEditingElement);
  const style = useMemo(() => textStyle(element, theme), [element, theme]);
  const done = useRef(false);

  const finish = useCallback(
    (html: string) => {
      if (done.current) return;
      done.current = true;
      const normalized = html === "<p></p>" ? "" : html;
      if (normalized !== element.html) updateElement(slideId, element.id, { html: normalized });
      setEditingElement(null);
      onExit?.();
    },
    [element.html, element.id, slideId, updateElement, setEditingElement, onExit],
  );
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    autofocus: "end",
    content: element.html,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
        orderedList: false,
        undoRedo: {},
      }),
      Placeholder.configure({ placeholder: "Type here" }),
    ],
    editorProps: {
      attributes: { class: "deck-text deck-text-editing", spellcheck: "true" },
      handleKeyDown: (_view, event) => {
        // Keep every key inside the editor; the stage's shortcuts must not fire.
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          finishRef.current(editorRef.current?.getHTML() ?? _view.dom.innerHTML);
          return true;
        }
        return false;
      },
    },
    onBlur: ({ editor: e }) => finishRef.current(e.getHTML()),
  });

  // Commit if the element unmounts mid-edit (slide change, deletion).
  useEffect(() => {
    return () => {
      if (!done.current && editor && !editor.isDestroyed) finishRef.current(editor.getHTML());
    };
  }, [editor]);

  useEffect(() => {
    editorRef.current = editor;
    if (editor && !editor.isFocused) editor.commands.focus("end");
  }, [editor]);

  return (
    <div
      className="deck-text-editor"
      style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: VALIGN[element.valign] }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} style={{ ...style, width: "100%", maxHeight: "100%", overflow: "auto", cursor: "text" }} />
    </div>
  );
}
