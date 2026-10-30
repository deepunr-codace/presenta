import { call, send } from "@/lib/collab";
import type { NewTemplateInput, TemplateEntry, TemplatePatch } from "@/lib/templates-db";
import type { TemplateCategory, TemplateScope } from "@/lib/template-scopes";

/**
 * Browser-side calls for the templates library. The rules (who may publish where, who may change a template) are
 * enforced by the API routes; this module only shapes the requests.
 */

export type { NewTemplateInput, TemplateEntry, TemplatePatch, TemplateCategory, TemplateScope };
export { TEMPLATE_CATEGORIES, TEMPLATE_SCOPES, TEMPLATE_SCOPE_LABEL } from "@/lib/template-scopes";

/** Everything I can use: my own templates, my teams' and the global library. */
export const fetchTemplates = () =>
  call<{ templates: TemplateEntry[] }>("/api/templates", undefined, "Could not load your templates.").then((r) => r.templates);

export const createTemplate = (input: NewTemplateInput) =>
  call<{ template: TemplateEntry }>("/api/templates", send("POST", input), "Could not publish the template.").then((r) => r.template);

export const updateTemplate = (id: string, patch: TemplatePatch) =>
  call<{ template: TemplateEntry }>(`/api/templates/${encodeURIComponent(id)}`, send("PATCH", patch), "Could not change the template.").then((r) => r.template);

export const deleteTemplate = (id: string) =>
  call<{ ok: true }>(`/api/templates/${encodeURIComponent(id)}`, send("DELETE"), "Could not delete the template.");

/** Start a new deck of mine from a template; opens in the editor. */
export const startFromTemplate = (id: string) =>
  call<{ deckId: string; title: string }>(`/api/templates/${encodeURIComponent(id)}/use`, send("POST"), "Could not start a deck from this template.");
