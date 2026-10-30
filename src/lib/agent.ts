export const AGENT_PROMPT_KEY = "presenta:agent-prompt";

/** Queue a prompt for the agent route without putting user text in the URL. */
export function queueAgentPrompt(prompt: string): void {
  const clean = prompt.trim().slice(0, 2000);
  if (!clean) throw new Error("Describe the deck you want first.");
  window.sessionStorage.setItem(AGENT_PROMPT_KEY, clean);
}
