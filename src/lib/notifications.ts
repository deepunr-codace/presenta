export type AppNotificationKind = "activity" | "message" | "invite";

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

const eventName = "presenta:notifications";
const storageKey = (userId: string) => `presenta.notifications.v1:${userId}`;
const seenInvitesKey = (userId: string) => `presenta.notifications.invites.v1:${userId}`;
const chatCursorsKey = (userId: string) => `presenta.notifications.cursors.v1:${userId}`;
const memory = new Map<string, AppNotification[]>();
const memoryCursors = new Map<string, Record<string, string>>();

function read(userId: string): AppNotification[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return memory.get(userId) ?? [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return (parsed as AppNotification[]).filter((item) => item && typeof item.id === "string");
  } catch {
    // Fall through to this tab's in-memory copy if storage is unavailable.
  }
  return memory.get(userId) ?? [];
}

function write(userId: string, items: AppNotification[]) {
  const next = items.slice(0, 150);
  memory.set(userId, next);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // The in-memory copy still works for the current tab.
  }
  window.dispatchEvent(new CustomEvent(eventName, { detail: userId }));
}

export function getAppNotifications(userId: string): AppNotification[] {
  return read(userId);
}

export function subscribeAppNotifications(userId: string, listener: () => void): () => void {
  const onLocal = (event: Event) => {
    if ((event as CustomEvent<string>).detail === userId) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(userId)) listener();
  };
  window.addEventListener(eventName, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(eventName, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

export function recordAppNotification(userId: string, notification: Omit<AppNotification, "read">) {
  const current = read(userId);
  if (current.some((item) => item.id === notification.id)) return;
  write(userId, [{ ...notification, read: false }, ...current]);
}

export function markAppNotificationRead(userId: string, id?: string) {
  write(userId, read(userId).map((item) => (!id || item.id === id) && !item.read ? { ...item, read: true } : item));
}

export function clearAppNotifications(userId: string) {
  write(userId, []);
}

export function getSeenInviteTokens(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(seenInvitesKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function rememberInviteTokens(userId: string, tokens: string[]) {
  try {
    window.localStorage.setItem(seenInvitesKey(userId), JSON.stringify(tokens.slice(-500)));
  } catch {
    // The notification list itself still deduplicates within this session.
  }
}

export function getNotificationChatCursors(userId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(chatCursorsKey(userId));
    if (!raw) return memoryCursors.get(userId) ?? {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return memoryCursors.get(userId) ?? {};
  }
}

export function saveNotificationChatCursors(userId: string, cursors: Record<string, string>) {
  memoryCursors.set(userId, cursors);
  try {
    window.localStorage.setItem(chatCursorsKey(userId), JSON.stringify(cursors));
  } catch {
    // The in-memory cursor still keeps polling deduplicated in this tab.
  }
}
