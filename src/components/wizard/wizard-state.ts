"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Brand, Brief, BriefStage, Outline, ThemeId } from "@/lib/deck/schema";

/**
 * Wizard state for /new. Persisted to sessionStorage under "presenta:wizard"
 * so a refresh keeps the user's place; "Start over" clears it. Transient
 * state (hydration) is excluded from persistence.
 */

const WIZARD_STORAGE_KEY = "presenta:wizard";

export type WizardStep = "brief" | "outline" | "brand" | "generate" | "review";
export type IntakeMode = "chat" | "paste";

export const STEP_ORDER: readonly WizardStep[] = ["brief", "outline", "brand", "generate", "review"];

export const STEP_META: Record<WizardStep, { label: string; hint: string }> = {
  brief: { label: "Brief", hint: "What the deck is about" },
  outline: { label: "Outline", hint: "Slides and key points" },
  brand: { label: "Brand", hint: "Theme, colours, fonts" },
  generate: { label: "Generate", hint: "Write and design slides" },
  review: { label: "Review", hint: "Check and edit the deck" },
};

export function stepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

export const TONES = ["confident and clear", "friendly", "formal", "bold", "minimal"] as const;
export type Tone = (typeof TONES)[number];

export function isTone(v: unknown): v is Tone {
  return typeof v === "string" && (TONES as readonly string[]).includes(v);
}

export const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch", "Japanese", "Hindi"] as const;

const DEFAULT_THEME_ID: ThemeId = "glass-contrast";
const DEFAULT_SLIDE_COUNT = 10;

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  /** For assistant questions: the brief stage being asked. */
  stage?: BriefStage;
};

type WizardSettings = {
  slideCount: number;
  tone: Tone;
  language: string;
};

type PasteDraft = {
  text: string;
  audience: string;
  goal: string;
};

export type WizardData = {
  step: WizardStep;
  mode: IntakeMode | null;
  brief: Brief;
  chat: { messages: ChatMessage[]; stage: BriefStage };
  paste: PasteDraft;
  settings: WizardSettings;
  outline: Outline | null;
  themeId: ThemeId;
  brand: Brand;
  deckId: string | null;
};

type WizardTransient = {
  /** True once sessionStorage has been read on the client. */
  hydrated: boolean;
};

type WizardActions = {
  setStep: (step: WizardStep) => void;
  setMode: (mode: IntakeMode | null) => void;
  startChat: (firstQuestion: ChatMessage) => void;
  patchBrief: (patch: Partial<Brief>) => void;
  appendChat: (messages: ChatMessage[], stage?: BriefStage) => void;
  setChatStage: (stage: BriefStage) => void;
  resetChat: (firstQuestion: ChatMessage) => void;
  patchPaste: (patch: Partial<PasteDraft>) => void;
  patchSettings: (patch: Partial<WizardSettings>) => void;
  setOutline: (outline: Outline | null) => void;
  setThemeId: (themeId: ThemeId) => void;
  patchBrand: (patch: Partial<Brand>) => void;
  setDeckId: (id: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  /** Replace the wizard data, e.g. when the home page starts the wizard from a typed prompt. */
  seed: (data: Partial<WizardData>) => void;
  reset: () => void;
};

export type WizardStore = WizardData & WizardTransient & WizardActions;

const EMPTY_DATA: WizardData = {
  step: "brief",
  mode: null,
  brief: {},
  chat: { messages: [], stage: "topic" },
  paste: { text: "", audience: "", goal: "" },
  settings: { slideCount: DEFAULT_SLIDE_COUNT, tone: "confident and clear", language: "English" },
  outline: null,
  themeId: DEFAULT_THEME_ID,
  brand: {},
  deckId: null,
};

const DATA_KEYS = Object.keys(EMPTY_DATA) as (keyof WizardData)[];

function pickData(state: WizardStore): WizardData {
  const out: Partial<WizardData> = {};
  for (const key of DATA_KEYS) {
    (out as Record<string, unknown>)[key] = state[key];
  }
  return out as WizardData;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set) => ({
      ...EMPTY_DATA,
      hydrated: false,

      setStep: (step) => set({ step }),
      setMode: (mode) => set({ mode }),
      startChat: (firstQuestion) =>
        set((s) => (s.chat.messages.length ? { mode: "chat" } : { mode: "chat", chat: { messages: [firstQuestion], stage: "topic" } })),
      patchBrief: (patch) => set((s) => ({ brief: { ...s.brief, ...patch } })),
      appendChat: (messages, stage) =>
        set((s) => ({ chat: { messages: [...s.chat.messages, ...messages], stage: stage ?? s.chat.stage } })),
      setChatStage: (stage) => set((s) => ({ chat: { ...s.chat, stage } })),
      resetChat: (firstQuestion) => set({ chat: { messages: [firstQuestion], stage: "topic" }, brief: {}, outline: null, deckId: null }),
      patchPaste: (patch) => set((s) => ({ paste: { ...s.paste, ...patch } })),
      patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setOutline: (outline) => set({ outline }),
      setThemeId: (themeId) => set({ themeId }),
      patchBrand: (patch) =>
        set((s) => {
          const next: Brand = { ...s.brand, ...patch };
          // Drop cleared keys so the persisted brand stays minimal and schema-valid.
          for (const key of Object.keys(next) as (keyof Brand)[]) {
            const v = next[key];
            if (v === undefined || v === "") delete next[key];
          }
          return { brand: next };
        }),
      setDeckId: (deckId) => set({ deckId }),
      setHydrated: (hydrated) => set({ hydrated }),
      seed: (data) => set({ ...EMPTY_DATA, ...data }),
      reset: () => set({ ...EMPTY_DATA }),
    }),
    {
      name: WIZARD_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => pickData(state),
      // Hydrate from an effect (see Wizard.tsx) so server and first client render match.
      skipHydration: true,
    },
  ),
);

/** Clear the persisted wizard and reset in-memory state. */
export function clearWizard(): void {
  useWizardStore.getState().reset();
  try {
    sessionStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- Derived helpers ---------- */

let counter = 0;
export function messageId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}${counter}`;
}

/** Serialize the brief and transcript into the `input` of a chat-mode GenerateRequest. */
function briefToInput(brief: Brief, messages: ChatMessage[]): string {
  const or = (v: string | undefined) => (v?.trim() ? v.trim() : "(not specified)");
  const lines = [
    `Topic: ${or(brief.topic)}`,
    `Audience: ${or(brief.audience)}`,
    `Goal: ${or(brief.goal)}`,
    `Must include: ${brief.mustInclude?.length ? brief.mustInclude.join("; ") : "(not specified)"}`,
    `Angle: ${or(brief.angle)}`,
  ];
  if (messages.length) {
    lines.push("Conversation:");
    for (const m of messages) lines.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.text.replace(/\s*\n\s*/g, " ")}`);
  }
  return lines.join("\n");
}

/** The text the generator receives, by intake mode. */
export function generationInput(data: Pick<WizardData, "mode" | "brief" | "chat">): string {
  if (data.mode === "paste") return (data.brief.source ?? "").trim();
  return briefToInput(data.brief, data.chat.messages);
}

/** Which steps the user may jump back to from the current one. */
export function reachableSteps(data: Pick<WizardData, "step" | "deckId">): Set<WizardStep> {
  const current = stepIndex(data.step);
  const out = new Set<WizardStep>();
  STEP_ORDER.forEach((s, i) => {
    if (i < current) out.add(s);
  });
  if (data.deckId) out.add("review");
  return out;
}
