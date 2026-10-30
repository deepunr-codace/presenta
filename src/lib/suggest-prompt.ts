/**
 * Local, offline "ghost text" continuation for the prompt box: as the user types a deck topic, suggest a short,
 * concrete audience-and-goal clause to complete the sentence. Runs entirely in the browser (no AI round trip), so
 * it is instant and free; the wording is picked by keyword match, not generated, so it is deterministic per topic.
 */

type Pool = { match: RegExp; endings: string[] };

const POOLS: Pool[] = [
  { match: /\b(pitch|investor|fundrais|seed|series [ab])\b/i, endings: [" for investors deciding whether to fund the next round, built around traction, market size and the ask", " that gets a partner to say yes in the room, leading with the problem and the proof", " for a seed round, opening with the one number that makes this undeniable"] },
  { match: /\b(startup|founders?)\b/i, endings: [" for early believers, written to move fast from problem to proof", " that a first-time founder could present with total confidence"] },
  { match: /\b(sales|proposal|client|customer|prospect)\b/i, endings: [" for a prospective client, tailored to their exact challenge with clear next steps", " that closes the deal: their problem, our approach, proof it works, simple pricing"] },
  { match: /\b(product|launch|feature|roadmap)\b/i, endings: [" for the product team, from the customer problem to how we measure success", " that rallies the company behind this quarter's three priorities"] },
  { match: /\b(quarterly|qbr|review|board|results)\b/i, endings: [" for leadership, covering the headline numbers, risks and next quarter's plan", " for the board: what worked, what did not, and the decision we need from them"] },
  { match: /\b(training|workshop|onboarding|course|class|curriculum)\b/i, endings: [" for new hires, with one clear exercise per module and a recap at the end", " that teaches the concept in plain language, one idea per slide"] },
  { match: /\b(marketing|brand|campaign)\b/i, endings: [" for the marketing team, grounded in the audience insight that makes this campaign work", " that gets stakeholders excited about the creative direction and the plan behind it"] },
  { match: /\b(team|offsite|culture|all.?hands)\b/i, endings: [" for the whole team, honest about the challenge ahead and confident about the plan", " for an offsite: where we stand, what changes, and what we are betting on"] },
  { match: /\b(conference|keynote|talk|summit)\b/i, endings: [" for a room of peers, opening with a story they have not heard before", " that leaves the audience with one idea they will repeat to someone else"] },
  { match: /\b(portfolio|case stud|showcase)\b/i, endings: [" that shows the work, not just claims about it, with real numbers behind each case", " for a client review, walking through the thinking behind every decision"] },
];

const GENERIC_ENDINGS = [
  " for the team that needs to act on it, with a clear ask on the final slide",
  " that a skeptical reader finishes convinced, not just informed",
  " with one idea per slide and a narrative that builds toward a decision",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Returns the suggested continuation (not the full text), or null when there is nothing useful to add: the
 * input is empty, already ends with sentence punctuation, or is long enough that a canned clause would just
 * be noise.
 */
export function suggestPromptCompletion(input: string): string | null {
  const text = input.trimEnd();
  if (!text || text.length < 6 || text.length > 160) return null;
  if (/[.!?]$/.test(text)) return null;

  const pool = POOLS.find((p) => p.match.test(text));
  const endings = pool?.endings ?? GENERIC_ENDINGS;
  const key = pool?.match.source ?? text.slice(0, 12);
  const ending = endings[hashString(key) % endings.length];

  // The caret sits right after `input`; if the user already typed a trailing space, don't double it.
  return /\s$/.test(input) ? ending.trimStart() : ending;
}
