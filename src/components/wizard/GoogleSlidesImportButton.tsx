"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogo } from "@phosphor-icons/react";
import { importDeckFile, saveDeck } from "@/lib/persist";
import { useToast } from "@/components/shell/Toast";

type PickerData = { action?: string; docs?: { id?: string }[] };
type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setMaxItems(max: number): PickerBuilder;
  setCallback(callback: (data: PickerData) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
};
type GooglePickerWindow = Window & {
  gapi?: { load(name: string, options: { callback: () => void; onerror?: () => void }): void };
  google?: { picker: { PickerBuilder: new () => PickerBuilder; ViewId: { PRESENTATIONS: unknown }; Action: { PICKED: string } } };
};

let pickerLoad: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  const w = window as GooglePickerWindow;
  if (w.google?.picker?.PickerBuilder) return Promise.resolve();
  pickerLoad ??= new Promise<void>((resolve, reject) => {
    const ready = () => {
      const gapi = (window as GooglePickerWindow).gapi;
      if (!gapi) { reject(new Error("Google Picker could not load.")); return; }
      gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Google Picker could not load.")) });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-presenta-google-picker]');
    if (existing) {
      if ((window as GooglePickerWindow).gapi) ready();
      else { existing.addEventListener("load", ready, { once: true }); existing.addEventListener("error", () => reject(new Error("Google Picker could not load.")), { once: true }); }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.dataset.presentaGooglePicker = "true";
    script.onload = ready;
    script.onerror = () => reject(new Error("Google Picker could not load."));
    document.head.appendChild(script);
  }).catch((error) => { pickerLoad = null; throw error; });
  return pickerLoad;
}

async function importSelectedSlides(fileId: string): Promise<File> {
  const response = await fetch("/api/integrations/google-drive/import-slides", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId }), cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not import this Google Slides presentation.");
  }
  const name = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return new File([await response.blob()], name ? decodeURIComponent(name) : "Google Slides presentation.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export function GoogleSlidesImportButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importSlides = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const configResponse = await fetch("/api/integrations/google-drive/picker-config", { cache: "no-store" });
      const config = await configResponse.json().catch(() => null) as { accessToken?: string; developerKey?: string; appId?: string; error?: string } | null;
      if (!configResponse.ok || !config?.accessToken || !config.developerKey || !config.appId) throw new Error(config?.error ?? "Connect Google Drive in Integrations first.");
      await loadPicker();
      const pickerWindow = window as GooglePickerWindow;
      const picker = new pickerWindow.google!.picker.PickerBuilder()
        .addView(pickerWindow.google!.picker.ViewId.PRESENTATIONS)
        .setOAuthToken(config.accessToken)
        .setDeveloperKey(config.developerKey)
        .setAppId(config.appId)
        .setTitle("Choose a Google Slides presentation")
        .setMaxItems(1)
        .setCallback((data) => {
          if (data.action !== pickerWindow.google!.picker.Action.PICKED || !data.docs?.[0]?.id) { setBusy(false); return; }
          void (async () => {
            try {
              const file = await importSelectedSlides(data.docs![0].id!);
              const deck = await importDeckFile(file);
              await saveDeck(deck);
              toast("Google Slides imported as an editable deck.", { tone: "success" });
              router.push(`/deck/${encodeURIComponent(deck.id)}`);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not import this Google Slides presentation.");
            } finally { setBusy(false); }
          })();
        })
        .build();
      picker.setVisible(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Google Drive.");
      setBusy(false);
    }
  };

  return <div className="flex flex-col items-start gap-1">
    <button type="button" className="ps-btn ps-btn-xs" disabled={busy} onClick={() => void importSlides()}>
      <GoogleLogo size={14} /> {busy ? "Importing…" : "Import Google Slides"}
    </button>
    {error ? <span className="max-w-xs text-[12px] text-[var(--ps-danger)]" role="alert">{error}</span> : null}
  </div>;
}
