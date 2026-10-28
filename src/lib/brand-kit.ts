import { BrandSchema, ThemeIdSchema, type Brand, type ThemeId } from "@/lib/deck/schema";
import { putSettings } from "@/lib/settings-api";

/**
 * The saved brand kit: company, logo, accent, fonts, AI notes and a default theme, applied to every new deck the
 * wizard starts. It is saved to the signed-in account and cached in this browser (localStorage, "presenta:brand-kit")
 * so it can be read synchronously.
 */

export const BRAND_KIT_KEY = "presenta:brand-kit";
export const BRAND_KIT_EVENT = "presenta:brand-kit-changed";

export type BrandKit = { brand: Brand; themeId?: ThemeId };

export function isEmptyKit(kit: BrandKit): boolean {
  return Object.keys(kit.brand).length === 0 && !kit.themeId;
}

/** The stored kit as raw text (a stable primitive, so it suits `useSyncExternalStore`). */
export function getBrandKitRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BRAND_KIT_KEY);
  } catch {
    return null;
  }
}

/** Validate stored text; anything malformed or empty counts as no kit. */
export function parseBrandKit(raw: string | null): BrandKit | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as { brand?: unknown; themeId?: unknown };
    const brand = BrandSchema.safeParse(json.brand ?? {});
    if (!brand.success) return null;
    const theme = ThemeIdSchema.safeParse(json.themeId);
    const kit: BrandKit = { brand: brand.data, themeId: theme.success ? theme.data : undefined };
    return isEmptyKit(kit) ? null : kit;
  } catch {
    return null;
  }
}

export function getBrandKit(): BrandKit | null {
  return parseBrandKit(getBrandKitRaw());
}

/** Write the kit to this browser only (used when the account's copy is pulled down). Pass null to clear it. */
export function setBrandKitLocal(kit: BrandKit | null): void {
  try {
    if (kit && !isEmptyKit(kit)) window.localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit));
    else window.localStorage.removeItem(BRAND_KIT_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(BRAND_KIT_EVENT));
}

/** Save to this browser and to the account. Throws when the browser refuses to store the kit (for example a full quota). */
export function saveBrandKit(kit: BrandKit): void {
  if (isEmptyKit(kit)) {
    clearBrandKit();
    return;
  }
  window.localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit));
  window.dispatchEvent(new Event(BRAND_KIT_EVENT));
  void putSettings({ brandKit: kit });
}

export function clearBrandKit(): void {
  setBrandKitLocal(null);
  void putSettings({ brandKit: null });
}
