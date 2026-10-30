"use client";

import { useState } from "react";
import { Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearStoredKey, getStoredKey, maskKey, setStoredKey } from "@/lib/ai-key";
import type { AiProvider } from "@/lib/ai/auth";
import { useAiHealth } from "@/hooks/useAiHealth";
import { useApiKeyDialog } from "./api-key-dialog-store";

const PROVIDERS: { id: AiProvider; label: string; hint: string; docs: string }[] = [
  { id: "openai", label: "OpenAI", hint: "sk-…", docs: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", hint: "sk-ant-…", docs: "https://console.anthropic.com/settings/keys" },
];

/**
 * Bring-your-own-key settings. The key stays in this browser and is sent only with the visitor's own AI
 * requests; the server uses it for that request and does not store or log it.
 */
export function ApiKeyDialog() {
  const open = useApiKeyDialog((s) => s.open);
  const setOpen = useApiKeyDialog((s) => s.setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ps-keydialog">
        {/* Mounted only while open, so the form always starts from what is stored. */}
        <KeyForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function KeyForm({ onClose }: { onClose: () => void }) {
  const health = useAiHealth();
  const [initial] = useState(getStoredKey);
  const [provider, setProvider] = useState<AiProvider>(initial?.provider ?? "openai");
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(initial?.remember ?? true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ provider: AiProvider; apiKey: string } | null>(initial);

  const meta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const save = () => {
    try {
      setStoredKey({ provider, apiKey: value, remember });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the key in this browser.");
    }
  };

  const remove = () => {
    clearStoredKey();
    setSaved(null);
    setValue("");
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>API key</DialogTitle>
          <DialogDescription>
            {health?.serverKey && health.hasKey && !health.byok
              ? health.provider === "presenta" ? "Presenta Studio is included free with your account, with a daily allowance. Add your own key to remove the limit." : "This workspace already has AI turned on. Add your own key to use your account instead."
              : "Presenta uses your own AI account to write decks. Without a key you get the offline demo."}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <p className="ps-keydialog-saved" role="status">
            Using your {PROVIDERS.find((p) => p.id === saved.provider)?.label} key <code>{maskKey(saved.apiKey)}</code>
          </p>
        ) : null}

        <div className="ps-keydialog-seg" role="radiogroup" aria-label="Provider">
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={provider === p.id} data-active={provider === p.id ? "true" : undefined} onClick={() => setProvider(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <label className="ps-keydialog-field">
          <span>{meta.label} API key</span>
          <span className="ps-keydialog-input">
            <input
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={saved ? "Paste a new key to replace it" : meta.hint}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              aria-invalid={error ? true : undefined}
              onKeyDown={(e) => e.key === "Enter" && value.trim() && save()}
            />
            <button type="button" className="ps-iconbtn" aria-label={show ? "Hide key" : "Show key"} onClick={() => setShow((v) => !v)}>
              {show ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        {error ? (
          <p className="ps-keydialog-error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="ps-keydialog-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember on this device
        </label>

        <p className="ps-keydialog-note">
          <LockKey size={14} aria-hidden />
          <span>
            Your key stays in this browser and is sent only with your own requests, over HTTPS. We never store or log it.{" "}
            <a href={meta.docs} target="_blank" rel="noreferrer noopener">
              Get a {meta.label} key
            </a>
          </span>
        </p>

        <DialogFooter>
          {saved ? (
            <button type="button" className="ps-btn" data-danger="true" onClick={remove}>
              Remove key
            </button>
          ) : null}
          <button type="button" className="ps-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ps-btn ps-btn-primary" onClick={save} disabled={!value.trim()}>
            Save key
          </button>
        </DialogFooter>
    </>
  );
}

