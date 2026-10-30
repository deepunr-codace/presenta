"use client";

export function getPublicVisitorId(): string {
  const key = "presenta:public-visitor-id";
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch { return window.crypto.randomUUID(); }
}
