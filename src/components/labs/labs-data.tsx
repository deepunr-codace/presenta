import type { ReactNode } from "react";
import { ChartBar, ChatsCircle, FileText, FilmStrip, Gauge, ImageSquare, Robot, ShieldCheck, Table, Translate, UsersThree, Waveform } from "@phosphor-icons/react";

export type LabsCategory = "Create" | "Collaborate" | "Present" | "Share";
export type LabsStage = "Early preview" | "In design" | "Coming soon";

export type LabsFeature = {
  id: string;
  title: string;
  category: LabsCategory;
  stage: LabsStage;
  description: string;
  icon: ReactNode;
  /** Two colours for the icon plate and card glow. */
  tint: [string, string];
};

export const LABS_CATEGORIES: ("All" | LabsCategory)[] = ["All", "Create", "Collaborate", "Present", "Share"];

/** Placeholder previews of where the product is heading. None of these work yet; "Notify me" only records interest locally. */
export const LABS_FEATURES: LabsFeature[] = [
  {
    id: "agent-mode",
    title: "Agent mode",
    category: "Create",
    stage: "Early preview",
    description: "Describe the outcome and an AI agent researches, outlines, designs and polishes the whole deck, asking only when it needs you.",
    icon: <Robot />,
    tint: ["#0447FF", "#7C3AED"],
  },
  {
    id: "image-studio",
    title: "AI image studio",
    category: "Create",
    stage: "In design",
    description: "Generate on-brand illustrations and photos for any slide, matched to your palette and style, right on the canvas.",
    icon: <ImageSquare />,
    tint: ["#DB2777", "#F59E0B"],
  },
  {
    id: "doc-to-deck",
    title: "Doc and URL to deck",
    category: "Create",
    stage: "In design",
    description: "Paste a link or drop a PDF, report or spec and get a structured deck that keeps the facts and cites the source.",
    icon: <FileText />,
    tint: ["#0EA5E9", "#059669"],
  },
  {
    id: "smart-charts",
    title: "Smart charts from data",
    category: "Create",
    stage: "Coming soon",
    description: "Upload a spreadsheet and get the right chart, a headline that states the insight, and speaker notes explaining it.",
    icon: <Table />,
    tint: ["#059669", "#0EA5E9"],
  },
  {
    id: "live-coediting",
    title: "Live co-editing",
    category: "Collaborate",
    stage: "In design",
    description: "Edit together in real time with cursors, comments and suggestions, and resolve changes without leaving the canvas.",
    icon: <UsersThree />,
    tint: ["#7C3AED", "#DB2777"],
  },
  {
    id: "brand-guardian",
    title: "Brand guardian",
    category: "Collaborate",
    stage: "Coming soon",
    description: "Every slide is checked against your brand kit: colours, fonts, logo use and tone, with one-click fixes.",
    icon: <ShieldCheck />,
    tint: ["#1B5FD9", "#059669"],
  },
  {
    id: "voice-narration",
    title: "Voice narration",
    category: "Present",
    stage: "Early preview",
    description: "Turn speaker notes into natural voiceover for each slide, so a deck can present itself while you are away.",
    icon: <Waveform />,
    tint: ["#EA580C", "#DB2777"],
  },
  {
    id: "presenter-coach",
    title: "Presenter coach",
    category: "Present",
    stage: "Coming soon",
    description: "Rehearse out loud and get feedback on pace, filler words and timing per slide, with tips to tighten the story.",
    icon: <Gauge />,
    tint: ["#F59E0B", "#EA580C"],
  },
  {
    id: "audience-qa",
    title: "Live audience Q&A",
    category: "Present",
    stage: "In design",
    description: "Let the room ask questions and vote in polls from their phones, and see the answers appear on your slides.",
    icon: <ChatsCircle />,
    tint: ["#0EA5E9", "#7C3AED"],
  },
  {
    id: "instant-translate",
    title: "Instant translate",
    category: "Share",
    stage: "Coming soon",
    description: "Translate a whole deck in one click while keeping layouts tidy, so the same story reaches every market.",
    icon: <Translate />,
    tint: ["#059669", "#7C3AED"],
  },
  {
    id: "video-export",
    title: "Video export",
    category: "Share",
    stage: "In design",
    description: "Export an animated MP4 with transitions and narration, ready to post or send.",
    icon: <FilmStrip />,
    tint: ["#DB2777", "#7C3AED"],
  },
  {
    id: "deck-analytics",
    title: "Deck analytics",
    category: "Share",
    stage: "Coming soon",
    description: "Share a link and see who opened it, which slides held attention and where people dropped off.",
    icon: <ChartBar />,
    tint: ["#0447FF", "#0EA5E9"],
  },
];

/** The three previews highlighted in the sidebar. */
export const LABS_HIGHLIGHTS = ["agent-mode", "voice-narration", "live-coediting"] as const;
