import { BrandSchema, ThemeIdSchema, type Brand, type ThemeId } from "@/lib/deck/schema";

/**
 * The saved brand kit: company, logo, accent, fonts, AI notes and a default theme, kept in this browser
 * (localStorage, "presenta:brand-kit") and applied to every new deck the wizard starts.
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

/** Throws when the browser refuses to store the kit (for example a full quota). */
export function saveBrandKit(kit: BrandKit): void {
  if (isEmptyKit(kit)) {
    clearBrandKit();
    return;
  }
  window.localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kit));
  window.dispatchEvent(new Event(BRAND_KIT_EVENT));
}

export function clearBrandKit(): void {
  try {
    window.localStorage.removeItem(BRAND_KIT_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(BRAND_KIT_EVENT));
}
