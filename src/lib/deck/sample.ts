import { buildDeck } from "./layouts";
import type { Deck, Generation } from "./schema";

/** Hand-written generation exercising every slide kind. */
export const SAMPLE_GENERATION: Generation = {
  title: "CodeAce × Robustrade: One System for Global Trade",
  slides: [
    {
      kind: "cover",
      title: "One System for Global Trade",
      subtitle: "An ERP proposal for Robustrade, prepared by CodeAce",
      body: "September 2026 · Confidential",
      imageQuery: "container ship at a modern port at dawn, aerial view, blue tones",
      notes: "Open with the scale of Robustrade's operations and why now is the moment to unify.",
    },
    {
      kind: "section",
      title: "Where trade slows down today",
      subtitle: "Six regional offices, four ledgers, and a spreadsheet for everything in between",
    },
    {
      kind: "bullets",
      title: "The cost of disconnected systems",
      bullets: [
        "Order status lives in email threads, not in a system of record",
        "Landed cost is recalculated by hand for every shipment",
        "Month-end close takes 14 days across regional entities",
        "Compliance documents are re-keyed for each customs authority",
        "Nobody sees consolidated margin until the quarter ends",
      ],
      imageQuery: "warehouse manager reviewing paperwork on a clipboard, documentary style",
      notes: "Each bullet maps to a pain point raised in discovery interviews.",
    },
    {
      kind: "stats",
      title: "Robustrade at a glance",
      body: "A global trading group whose scale has outgrown its tooling.",
      stats: [
        { value: "10,000+", label: "Employees across 6 regions" },
        { value: "42", label: "Countries with active trade lanes" },
        { value: "$3.8B", label: "Annual traded volume" },
        { value: "14 days", label: "Current month-end close" },
      ],
    },
    {
      kind: "cards",
      title: "What one system delivers",
      cards: [
        { title: "Single order-to-cash flow", body: "Every quote, order, shipment and invoice in one record, visible to every office.", icon: "ArrowsLeftRight" },
        { title: "Live landed cost", body: "Freight, duties, insurance and FX applied automatically at booking time.", icon: "Calculator" },
        { title: "Compliance by default", body: "Customs, sanctions and certificate checks run before a shipment can be released.", icon: "ShieldCheck" },
      ],
    },
    {
      kind: "two-column",
      title: "Today versus the target state",
      columnTitles: ["Today", "With CodeAce ERP"],
      bullets: ["Four ledgers reconciled manually", "Pricing decided per office", "Inventory counted monthly", "Reports built in spreadsheets"],
      bulletsRight: ["One multi-entity ledger", "Global price lists with local overrides", "Perpetual inventory with lot tracking", "Dashboards refreshed hourly"],
    },
    {
      kind: "image-text",
      title: "Built for the trade desk, not just finance",
      body: "Traders see availability, margin and compliance status on one screen, so a deal can be confirmed while the counterparty is still on the call.",
      bullets: ["Real-time position by commodity and lane", "Margin guardrails before confirmation", "Documents generated from the order"],
      imageQuery: "trading desk with multiple monitors showing logistics dashboards, cinematic lighting",
    },
    {
      kind: "process",
      title: "Six steps from kickoff to go-live",
      steps: [
        { title: "Discover", body: "Map every entity, ledger and trade flow in four weeks of workshops." },
        { title: "Design", body: "Agree the global chart of accounts, item master and approval matrix." },
        { title: "Configure", body: "Set up entities, tax, currencies and integrations in a shared sandbox." },
        { title: "Migrate", body: "Cleanse and load open orders, stock and balances with reconciliation reports." },
        { title: "Train", body: "Role-based training for traders, operations, finance and leadership." },
        { title: "Go live", body: "Phased cutover by region with hypercare for the first two closes." },
      ],
    },
    {
      kind: "comparison",
      title: "Why CodeAce over a generic rollout",
      columnTitles: ["Generic ERP partner", "CodeAce"],
      bullets: ["Standard templates adapted after go-live", "Trade features bolted on later", "Fixed scope, change requests for everything"],
      bulletsRight: ["Trade-native data model from day one", "Landed cost and compliance in the core", "Outcome-based milestones with shared risk"],
    },
    {
      kind: "quote",
      title: "What our clients say",
      quote: {
        text: "We closed our first quarter on the new system in five days instead of three weeks, and every office was looking at the same numbers.",
        by: "CFO, Meridian Commodities",
      },
    },
    {
      kind: "cards",
      title: "Investment and timeline",
      body: "A fixed-fee programme with three payment milestones tied to outcomes.",
      cards: [
        { title: "Phase 1 · 3 months", body: "Discovery, design and finance core for the two largest entities.", icon: "NumberCircleOne" },
        { title: "Phase 2 · 4 months", body: "Trade, logistics and compliance modules across all regions.", icon: "NumberCircleTwo" },
        { title: "Phase 3 · 2 months", body: "Analytics, supplier portal and hypercare through two closes.", icon: "NumberCircleThree" },
        { title: "Ongoing", body: "Managed service with quarterly releases and a named success lead.", icon: "Infinity" },
      ],
    },
    {
      kind: "closing",
      title: "Let's build one system for global trade",
      subtitle: "Next step: a two-day discovery workshop with your regional leads",
      body: "hello@codeace.com · codeace.com/robustrade",
    },
  ],
};

export const SAMPLE_DECK: Deck = buildDeck(SAMPLE_GENERATION, "glass-contrast", {
  audience: "Robustrade executive team",
  tone: "confident and clear",
  source: "chat",
});
