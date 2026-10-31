"use client";

import { useState } from "react";
import { Eye, EyeSlash, LockKey, Sparkle } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearStoredKey, getStoredKey, maskKey, setStoredKey } from "@/lib/ai-key";
import type { AiProvider } from "@/lib/ai/auth";
import { useAiHealth } from "@/hooks/useAiHealth";
import { useApiKeyDialog } from "./api-key-dialog-store";

type Tab = "presenta" | AiProvider;

const PROVIDERS: { id: AiProvider; label: string; hint: string; docs: string }[] = [
  { id: "openai", label: "OpenAI", hint: "sk-…", docs: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", hint: "sk-ant-…", docs: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", label: "Gemini", hint: "AIza… or AQ.…", docs: "https://aistudio.google.com/apikey" },
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
  const [provider, setProvider] = useState<Tab>(initial?.provider ?? "presenta");
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(initial?.remember ?? true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ provider: AiProvider; apiKey: string } | null>(initial);

  const meta = PROVIDERS.find((p) => p.id === provider);
  const presentaActive = Boolean(health?.hasKey && health.provider === "presenta" && !health.byok);
  const assignedActive = Boolean(health?.assigned && !health.byok);
  const assignedLabel = health?.provider === "openai" ? "OpenAI" : health?.provider === "gemini" ? "Gemini" : "Anthropic";
  const usePresenta = () => {
    clearStoredKey();
    onClose();
  };

  const save = () => {
    if (provider === "presenta") return;
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
          <DialogDescription>Use Presenta Studio for free, or bring your own AI key.</DialogDescription>
        </DialogHeader>


        {assignedActive && !saved ? (
          <p className="ps-keydialog-saved" role="status">
            Your admin set up an {assignedLabel} key for you. It is used automatically; add a key below only to use your own instead.
          </p>
        ) : null}
        {saved ? (
          <p className="ps-keydialog-saved" role="status">
            Using your {PROVIDERS.find((p) => p.id === saved.provider)?.label} key <code>{maskKey(saved.apiKey)}</code>
          </p>
        ) : null}

        <div className="ps-keydialog-seg" role="radiogroup" aria-label="Provider">
          <button type="button" role="radio" aria-checked={provider === "presenta"} data-active={provider === "presenta" ? "true" : undefined} onClick={() => setProvider("presenta")}>
            Presenta
          </button>
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={provider === p.id} data-active={provider === p.id ? "true" : undefined} onClick={() => setProvider(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        {provider !== "presenta" && meta ? (
          <>
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
          </>
        ) : null}

        {provider === "presenta" ? (
          <div className="ps-keydialog-presenta">
            <div className="ps-keydialog-presenta-head">
              <span className="ps-keydialog-presenta-name">
                <span className="ps-keydialog-studio-mark" aria-hidden>
                  <Sparkle size={12} weight="fill" />
                </span>
                Presenta Studio
              </span>
              {presentaActive ? <span className="ps-keydialog-active">Active</span> : <span className="ps-keydialog-idle">Not in use</span>}
            </div>
            {health?.quota && !health.byok ? (
              <p className="ps-keydialog-usage">
                <span>{Math.max(health.quota.limit - health.quota.used, 0)}</span> of {health.quota.limit} free requests left today
              </p>
            ) : (
              <p className="ps-keydialog-usage-muted">Sign in to see your daily usage.</p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {saved ? (
            <button type="button" className="ps-btn" data-danger="true" onClick={remove}>
              Remove key
            </button>
          ) : null}
          <button type="button" className="ps-btn" onClick={onClose}>
            Cancel
          </button>
          {provider === "presenta" ? (
            <button type="button" className="ps-btn ps-btn-primary" onClick={usePresenta}>
              Use Presenta Studio
            </button>
          ) : (
            <button type="button" className="ps-btn ps-btn-primary" onClick={save} disabled={!value.trim()}>
              Save key
            </button>
          )}
        </DialogFooter>
    </>
  );
}

