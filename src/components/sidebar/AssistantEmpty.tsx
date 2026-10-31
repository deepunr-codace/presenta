import { Sparkle } from "@phosphor-icons/react";
import type { Scope } from "@/lib/assistant/scope";

type Props = { scope: Scope };

/** The assistant's opening message, worded for the current scope. */
export function AssistantEmpty({ scope }: Props) {
  const what = scope.kind === "deck" ? "the whole deck" : scope.kind === "slide" ? `slide ${scope.slideIndex + 1}` : scope.label.toLowerCase();
  return (
    <div className="ps-chat-row">
      <span className="ps-chat-avatar" aria-hidden>
        <Sparkle size={12} weight="fill" />
      </span>
      <div className="ps-chat-bubble">
        Hi! What should I change on {what}? Try “make this shorter”, “add a slide about pricing” or “new image idea”. Select something on the canvas to work on just that. You can undo every change.
      </div>
    </div>
  );
}
