import type { Scope } from "@/lib/assistant/scope";

type Props = { scope: Scope };

/** Dashed hint shown before the first message, worded for the current scope. */
export function AssistantEmpty({ scope }: Props) {
  const what = scope.kind === "deck" ? "the whole deck" : scope.kind === "slide" ? `slide ${scope.slideIndex + 1}` : scope.label.toLowerCase();
  return <div className="ps-empty">Ask for changes to {what}: “make this shorter”, “add a slide about pricing”, “new image idea”. Select something on the canvas to narrow the scope. Every reply is one undo step.</div>;
}
