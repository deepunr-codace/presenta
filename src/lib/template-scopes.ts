/**
 * Who a saved template belongs to. Kept in its own module (no imports) so the server store, the API client and the
 * gallery all agree on the same strings without pulling anything heavy into the browser bundle.
 *
 * - `personal`  only the person who saved it can see and use it
 * - `team`      everyone in the teams it was published to, plus the owner
 * - `global`    everyone signed in
 */
export const TEMPLATE_SCOPES = ["personal", "team", "global"] as const;
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

/** Saved templates use the same categories as the built-in starters, so the gallery filters both the same way. */
export const TEMPLATE_CATEGORIES = ["Business", "Product", "Education", "Team"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_SCOPE_LABEL: Record<TemplateScope, string> = {
  personal: "Personal",
  team: "Team",
  global: "Global",
};

export const isTemplateScope = (value: unknown): value is TemplateScope =>
  typeof value === "string" && (TEMPLATE_SCOPES as readonly string[]).includes(value);

export const isTemplateCategory = (value: unknown): value is TemplateCategory =>
  typeof value === "string" && (TEMPLATE_CATEGORIES as readonly string[]).includes(value);
