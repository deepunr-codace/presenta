export type RemoteControlState = {
  slideIndex: number;
  slideCount: number;
  revision: number;
  expiresAt: string;
};

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

export async function startRemoteControl(deckId: string, slideIndex: number): Promise<{ token: string; state: RemoteControlState }> {
  const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}/remote`, {
    method: "POST", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", slideIndex }),
  });
  if (!response.ok) throw await readError(response, "Could not start remote control.");
  return response.json() as Promise<{ token: string; state: RemoteControlState }>;
}

export async function stopRemoteControl(deckId: string): Promise<void> {
  const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}/remote`, {
    method: "POST", cache: "no-store", keepalive: true, headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "stop" }),
  });
  if (!response.ok) throw await readError(response, "Could not stop remote control.");
}

export async function getRemoteControlState(token: string): Promise<RemoteControlState | null> {
  const response = await fetch(`/api/remote/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw await readError(response, "Could not connect to the presenter.");
  return response.json() as Promise<RemoteControlState>;
}

export async function controlRemoteSlide(token: string, slideIndex: number): Promise<RemoteControlState | null> {
  const response = await fetch(`/api/remote/${encodeURIComponent(token)}`, {
    method: "POST", cache: "no-store", headers: { "content-type": "application/json" },
    body: JSON.stringify({ slideIndex }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await readError(response, "Could not send that slide command.");
  return response.json() as Promise<RemoteControlState>;
}
