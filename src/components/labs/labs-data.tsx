import type { ReactNode } from "react";
import { ChartBar, ChatsCircle, DeviceMobile, FileText, FilmStrip, ImageSquare, Microphone, Robot, ShieldCheck, Table, Translate, UsersThree, Waveform } from "@phosphor-icons/react";

export type LabsCategory = "Create" | "Collaborate" | "Present" | "Share";
export type LabsStage = "Available" | "Early preview" | "In design" | "Coming soon";

export type LabsFeature = {
  id: string;
  title: string;
  category: LabsCategory;
  stage: LabsStage;
  description: string;
  icon: ReactNode;
  /** Deep link shown for features already available in the product. */
  href?: string;
  /** Two colours for the icon plate and card glow. */
  tint: [string, string];
};

export const LABS_CATEGORIES: ("All" | LabsCategory)[] = ["All", "Create", "Collaborate", "Present", "Share"];

/** Available features link into the product; unreleased previews can be followed locally. */
export const LABS_FEATURES: LabsFeature[] = [
  {
    id: "agent-mode",
    title: "Agent mode",
    category: "Create",
    stage: "Available",
    description: "Create a researched, sourced deck from one prompt. Presenta plans an outline, writes and designs the slides, then opens the deck for editing.",
    icon: <Robot />,
    href: "/agent",
    tint: ["#0447FF", "#7C3AED"],
  },
  {
    id: "image-studio",
    title: "AI image studio",
    category: "Create",
    stage: "Available",
    description: "Generate slide-ready visuals from an image idea, guided by the deck’s theme colors. Requires an OpenAI API key.",
    icon: <ImageSquare />,
    href: "/decks",
    tint: ["#DB2777", "#F59E0B"],
  },
  {
    id: "doc-to-deck",
    title: "Document to deck",
    category: "Create",
    stage: "Available",
    description: "Import PDF, Word or PowerPoint content into an editable deck, with source references carried through.",
    icon: <FileText />,
    href: "/new",
    tint: ["#0EA5E9", "#059669"],
  },
  {
    id: "smart-charts",
    title: "Spreadsheet chart import",
    category: "Create",
    stage: "Available",
    description: "Import a CSV or the first worksheet of an Excel file into an editable chart with up to four numeric series.",
    icon: <Table />,
    href: "/decks",
    tint: ["#059669", "#0EA5E9"],
  },
  {
    id: "live-coediting",
    title: "Shared deck collaboration",
    category: "Collaborate",
    stage: "Available",
    description: "Invite collaborators, work with edit protection, discuss slides in comments, and restore saved versions.",
    icon: <UsersThree />,
    href: "/teams",
    tint: ["#7C3AED", "#DB2777"],
  },
  {
    id: "brand-guardian",
    title: "Brand guardian",
    category: "Collaborate",
    stage: "Available",
    description: "Check a deck’s theme, accent, fonts, company identity and AI brand notes against your saved kit, then apply the kit’s settings in one click.",
    icon: <ShieldCheck />,
    href: "/decks",
    tint: ["#1B5FD9", "#059669"],
  },
  {
    id: "voice-narration",
    title: "Voice narration",
    category: "Present",
    stage: "Available",
    description: "Narrate speaker notes or slide text during a presentation using a voice available in your browser.",
    icon: <Waveform />,
    href: "/decks",
    tint: ["#EA580C", "#DB2777"],
  },
  {
    id: "presenter-coach",
    title: "Presenter coach",
    category: "Present",
    stage: "Available",
    description: "Rehearse out loud and get feedback on pace, tracked filler words and timing per slide, with practical delivery tips.",
    icon: <Microphone />,
    href: "/decks",
    tint: ["#F59E0B", "#EA580C"],
  },
  {
    id: "phone-remote",
    title: "Phone presentation remote",
    category: "Present",
    stage: "Available",
    description: "Share an expiring remote link from presenter view, then move slides from another device without signing in.",
    icon: <DeviceMobile />,
    href: "/decks",
    tint: ["#0447FF", "#059669"],
  },
  {
    id: "audience-qa",
    title: "Live audience Q&A",
    category: "Present",
    stage: "Available",
    description: "Collect audience questions and run live polls from a shared presentation link.",
    icon: <ChatsCircle />,
    href: "/decks",
    tint: ["#0EA5E9", "#7C3AED"],
  },
  {
    id: "instant-translate",
    title: "Instant translate",
    category: "Share",
    stage: "Available",
    description: "Ask the deck assistant to translate a whole deck while preserving its structure and key details.",
    icon: <Translate />,
    href: "/decks",
    tint: ["#059669", "#7C3AED"],
  },
  {
    id: "video-export",
    title: "Presentation recording",
    category: "Share",
    stage: "Available",
    description: "Record a presentation through browser screen capture. The browser chooses MP4 when supported and otherwise records WebM.",
    icon: <FilmStrip />,
    href: "/decks",
    tint: ["#DB2777", "#7C3AED"],
  },
  {
    id: "deck-analytics",
    title: "Deck analytics",
    category: "Share",
    stage: "Available",
    description: "Review deck views and audience activity from share-link analytics.",
    icon: <ChartBar />,
    href: "/analytics",
    tint: ["#0447FF", "#0EA5E9"],
  },
];

/** Unreleased previews highlighted in the sidebar. */
export const LABS_HIGHLIGHTS = ["presenter-coach"] as const;
