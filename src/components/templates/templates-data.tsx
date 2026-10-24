import type { ReactNode } from "react";
import { Briefcase, ChartLineUp, ChalkboardTeacher, Flag, Handshake, Lightbulb, MapTrifold, Megaphone, RocketLaunch, UsersThree } from "@phosphor-icons/react";

export type TemplateCategory = "Business" | "Product" | "Education" | "Team";

export type Template = {
  id: string;
  title: string;
  category: TemplateCategory;
  description: string;
  slides: number;
  /** Becomes the first answer of the chat intake, so the AI knows what to write. */
  prompt: string;
  icon: ReactNode;
  /** Two colours for the card's header gradient. */
  tint: [string, string];
};

export const CATEGORIES: ("All" | TemplateCategory)[] = ["All", "Business", "Product", "Education", "Team"];

/** Ready-made starting points; each one seeds the wizard with a brief and a slide count. */
export const TEMPLATES: Template[] = [
  {
    id: "investor-pitch",
    title: "Investor pitch",
    category: "Business",
    description: "Problem, solution, traction, business model, team and the ask.",
    slides: 10,
    prompt: "A 10-slide investor pitch for our product: the problem, our solution, early traction, business model, market size, team and the ask.",
    icon: <RocketLaunch weight="fill" />,
    tint: ["#0447FF", "#7C3AED"],
  },
  {
    id: "quarterly-review",
    title: "Quarterly business review",
    category: "Business",
    description: "Headline results, what worked, what did not, risks and next quarter's plan.",
    slides: 8,
    prompt: "A quarterly business review for the leadership team: headline results, what worked, what did not, risks, and the plan for next quarter.",
    icon: <ChartLineUp weight="fill" />,
    tint: ["#059669", "#0EA5E9"],
  },
  {
    id: "sales-proposal",
    title: "Sales proposal",
    category: "Business",
    description: "Tailored pitch for a client: their needs, our approach, pricing and next steps.",
    slides: 9,
    prompt: "A sales proposal for a prospective client: their challenges, our approach, deliverables and timeline, pricing options, proof from similar clients and next steps.",
    icon: <Handshake weight="fill" />,
    tint: ["#EA580C", "#DB2777"],
  },
  {
    id: "company-overview",
    title: "Company overview",
    category: "Business",
    description: "Who we are, what we do, our customers and where we are going.",
    slides: 10,
    prompt: "A company overview deck: our story and mission, what we do, our customers, key numbers, culture and where we are going next.",
    icon: <Briefcase weight="fill" />,
    tint: ["#0F172A", "#475569"],
  },
  {
    id: "product-launch",
    title: "Product launch",
    category: "Product",
    description: "Announce a launch: the why, the product, key features and how to get started.",
    slides: 10,
    prompt: "A product launch announcement: the customer problem, the new product, three key features, how it works, pricing and availability, and how to get started.",
    icon: <Megaphone weight="fill" />,
    tint: ["#DB2777", "#F59E0B"],
  },
  {
    id: "product-roadmap",
    title: "Product roadmap",
    category: "Product",
    description: "Where the product is heading: themes, timeline and the reasoning behind it.",
    slides: 8,
    prompt: "A product roadmap presentation: our vision, this quarter's priorities, the next three themes with timelines, what we are deliberately not doing, and how we measure success.",
    icon: <MapTrifold weight="fill" />,
    tint: ["#7C3AED", "#0EA5E9"],
  },
  {
    id: "concept-explainer",
    title: "Concept explainer",
    category: "Education",
    description: "Teach a technical idea in plain language, one concept per slide.",
    slides: 8,
    prompt: "An 8-slide explainer that teaches a technical concept to newcomers in plain language, one idea per slide with a concrete example.",
    icon: <Lightbulb weight="fill" />,
    tint: ["#F59E0B", "#EA580C"],
  },
  {
    id: "training-workshop",
    title: "Training workshop",
    category: "Education",
    description: "A session plan with goals, modules, exercises and a recap.",
    slides: 12,
    prompt: "A training workshop deck: learning goals, an agenda, four short modules each with an exercise, common mistakes, a recap and next steps for participants.",
    icon: <ChalkboardTeacher weight="fill" />,
    tint: ["#0EA5E9", "#059669"],
  },
  {
    id: "project-kickoff",
    title: "Project kickoff",
    category: "Team",
    description: "Align a team: goals, scope, roles, timeline and risks.",
    slides: 8,
    prompt: "A project kickoff deck: why we are doing this, goals and success measures, scope and out of scope, roles, timeline and milestones, risks, and how we will communicate.",
    icon: <Flag weight="fill" />,
    tint: ["#1B5FD9", "#059669"],
  },
  {
    id: "team-update",
    title: "Team update",
    category: "Team",
    description: "A short all-hands: wins, metrics, challenges and what is next.",
    slides: 7,
    prompt: "A team all-hands update: recent wins, key metrics, challenges we are facing, shout-outs, and priorities for the coming weeks.",
    icon: <UsersThree weight="fill" />,
    tint: ["#7C3AED", "#DB2777"],
  },
];
