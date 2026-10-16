import type { ReactNode } from "react";
import { ChartLineUp, ClipboardText, Lightbulb, RocketLaunch, Sparkle, UploadSimple } from "@phosphor-icons/react";

export type Intent = "create" | "paste" | "import" | "sample";

/** Secondary ways to start, shown as outline pills beside the page title. */
export const ALT_STARTS: { id: Exclude<Intent, "create">; label: string; icon: ReactNode }[] = [
  { id: "paste", label: "From my content", icon: <ClipboardText /> },
  { id: "import", label: "Import JSON", icon: <UploadSimple /> },
  { id: "sample", label: "Open sample", icon: <Sparkle /> },
];

export const STARTERS: { icon: ReactNode; lead: string; prompt: string }[] = [
  {
    icon: <RocketLaunch />,
    lead: "Pitch a product",
    prompt: "A 10-slide investor pitch for our product: the problem, our solution, early traction, business model, team and the ask.",
  },
  {
    icon: <ChartLineUp />,
    lead: "Quarterly business review",
    prompt: "A quarterly business review for the leadership team: headline results, what worked, what did not, risks, and the plan for next quarter.",
  },
  {
    icon: <Lightbulb />,
    lead: "Explain a concept",
    prompt: "An 8-slide explainer that teaches a technical concept to newcomers in plain language, one idea per slide with a concrete example.",
  },
];
