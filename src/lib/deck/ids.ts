import { nanoid } from "nanoid";

/** Short random id, optionally prefixed: `newId("slide")` → `slide_V1StGXR8_Z`. */
export function newId(prefix?: string): string {
  const id = nanoid(10);
  return prefix ? `${prefix}_${id}` : id;
}
