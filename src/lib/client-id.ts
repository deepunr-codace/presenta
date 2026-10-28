/**
 * An id for this browser tab, sent with deck saves and edit-lock calls so the server can tell two tabs apart, even
 * when both belong to the same person. It changes on every page load and is never stored.
 */

export const CLIENT_HEADER = "x-client-id";

let id: string | null = null;

export function getClientId(): string {
  if (!id) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return id;
}
