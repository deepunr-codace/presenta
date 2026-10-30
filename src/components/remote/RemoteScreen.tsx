"use client";

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, DeviceMobile, WarningCircle } from "@phosphor-icons/react";
import { controlRemoteSlide, getRemoteControlState, type RemoteControlState } from "@/lib/remote-client";

type Props = { token: string };

export function RemoteScreen({ token }: Props) {
  const [state, setState] = useState<RemoteControlState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let gone = false;
    let loading = false;
    const poll = async () => {
      if (loading || gone) return;
      loading = true;
      try {
        const next = await getRemoteControlState(token);
        if (!alive) return;
        if (!next) {
          gone = true;
          setExpired(true);
          setError("This remote link has expired or was stopped by the presenter.");
        } else {
          setState(next);
          setError(null);
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Reconnecting to the presenter…");
      } finally { loading = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 900);
    return () => { alive = false; window.clearInterval(timer); };
  }, [token]);

  const send = async (slideIndex: number) => {
    if (!state || busy || expired) return;
    setBusy(true);
    try {
      const next = await controlRemoteSlide(token, slideIndex);
      if (!next) {
        setExpired(true);
        setError("This remote link has expired or was stopped by the presenter.");
      } else {
        setState(next);
        setError(null);
        if (navigator.vibrate) navigator.vibrate(12);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send that slide command.");
    } finally { setBusy(false); }
  };

  const connected = Boolean(state && !expired);

  return (
    <main className="ps-remote-page">
      <header className="ps-remote-head">
        <span className="ps-remote-mark"><DeviceMobile size={18} weight="bold" /></span>
        <div><p className="ps-remote-eyebrow">Presenta</p><h1>Presentation remote</h1></div>
      </header>
      <section className="ps-remote-card">
        <div className="ps-remote-status" data-connected={connected || undefined}>
          <span className="ps-remote-dot" /> {connected ? "Connected to presenter" : expired ? "Remote link ended" : "Connecting…"}
        </div>
        {state ? (
          <>
            <p className="ps-remote-current-label">Current slide</p>
            <p className="ps-remote-current" aria-live="polite"><span>{state.slideIndex + 1}</span><span className="ps-remote-total">/ {state.slideCount}</span></p>
            <div className="ps-remote-controls">
              <button type="button" className="ps-remote-button ps-remote-previous" onClick={() => void send(state.slideIndex - 1)} disabled={!connected || busy || state.slideIndex === 0} aria-label="Previous slide">
                <CaretLeft size={26} weight="bold" /><span>Previous</span>
              </button>
              <button type="button" className="ps-remote-button ps-remote-next" onClick={() => void send(state.slideIndex + 1)} disabled={!connected || busy || state.slideIndex >= state.slideCount - 1} aria-label="Next slide">
                <CaretRight size={26} weight="bold" /><span>Next</span>
              </button>
            </div>
            <p className="ps-remote-hint">Use the buttons to move the presentation on the main screen.</p>
          </>
        ) : <div className="ps-remote-wait" aria-busy="true">Waiting for the presentation…</div>}
        {error ? <p className="ps-remote-error" role="status"><WarningCircle size={15} />{error}</p> : null}
      </section>
      <p className="ps-remote-foot">Keep this page open while you present. Closing it will not end the presentation.</p>
    </main>
  );
}
