"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CaretLeft, CaretRight, Check, CopySimple, DeviceMobile, GearSix, Pause, Play, ShareNetwork, SpeakerHigh, SpeakerSlash, Stop, VideoCamera, X } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { STAGE_H, STAGE_W, type Slide } from "@/lib/deck/schema";
import { resolveTheme } from "@/lib/deck/themes";
import { narrationText } from "@/lib/narration";
import { useDeckEvent } from "@/hooks/useDeckEvent";
import { fetchDeckAudiencePolls, fetchLink, setLinkAccess, setLinkExpiry, shareLinkUrl, type AudiencePoll, type LinkState } from "@/lib/collab";
import { useNarration } from "@/hooks/useNarration";
import { downloadBlob } from "@/lib/persist";
import { controlRemoteSlide, getRemoteControlState, startRemoteControl, stopRemoteControl } from "@/lib/remote-client";
import { SlideRenderer } from "@/components/canvas/SlideRenderer";
import { PresentNotes } from "./PresentNotes";
import { useDeck } from "./useDeck";

const NOTES_HEIGHT = 220;
const IDLE_MS = 2000;

type Props = { id: string };

function slideImageSources(slide: Slide): string[] {
  const out: string[] = [];
  if (slide.background.kind === "image") out.push(slide.background.src);
  for (const el of slide.elements) if (el.type === "image" && el.src) out.push(el.src);
  return out;
}

function toggleFullscreen(): void {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  } else {
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }
}

/** Prefer MP4 where the browser can record it; otherwise keep the widely supported WebM recording path. */
function recordingMimeType(): string | undefined {
  const candidates = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Fullscreen black presenter: arrows, space and Enter move, N toggles notes, F fullscreen, V narrates,
 * Escape leaves. The controls (counter, previous/next, voice, exit) show for two seconds on entry and after
 * any keypress or mouse move, then fade; clicking the stage advances.
 */
export function PresentScreen({ id }: Props) {
  const router = useRouter();
  const { deck, status } = useDeck(id);
  useDeckEvent(id, "present", status === "ready");
  const theme = useMemo(() => (deck ? resolveTheme(deck) : null), [deck]);
  const count = deck?.slides.length ?? 0;

  const [rawIndex, setIndex] = useState(0);
  // Clamp at render time so a shrinking deck never leaves the index out of range.
  const index = Math.min(rawIndex, Math.max(0, count - 1));
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");
  const [notesOpen, setNotesOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [narrateOn, setNarrateOn] = useState(false);
  const [voicePanel, setVoicePanel] = useState(false);
  const [remotePanel, setRemotePanel] = useState(false);
  const [pollsPanel, setPollsPanel] = useState(false);
  const [sharePanel, setSharePanel] = useState(false);
  const [shareLink, setShareLink] = useState<LinkState | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [polls, setPolls] = useState<AudiencePoll[]>([]);
  const [pollsError, setPollsError] = useState("");
  const [remoteToken, setRemoteToken] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState("");
  const [remoteCopied, setRemoteCopied] = useState(false);
  const remoteRevision = useRef(0);
  const idleTimer = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState("");
  const activePoll = polls.find((poll) => !poll.endedAt) ?? null;
  const latestPoll = polls[0] ?? null;
  const audienceUrl = shareLink?.access === "anyone_view" && shareLink.token ? shareLinkUrl(shareLink.token) : "";
  const audienceLinkExpired = Boolean(shareLink?.expiresAt && Date.parse(shareLink.expiresAt) <= Date.now());

  useEffect(() => {
    if (!sharePanel || status !== "ready") return;
    let alive = true;
    setShareLoading(true);
    fetchLink(id)
      .then((link) => { if (alive) { setShareLink(link); setShareError(""); } })
      .catch((error) => { if (alive) setShareError(error instanceof Error ? error.message : "Could not load the public link."); })
      .finally(() => { if (alive) setShareLoading(false); });
    return () => { alive = false; };
  }, [id, sharePanel, status]);

  const enableAudienceLink = async () => {
    setShareBusy(true);
    setShareError("");
    try { setShareLink(await setLinkAccess(id, "anyone_view")); }
    catch (error) { setShareError(error instanceof Error ? error.message : "Could not enable the public link."); }
    finally { setShareBusy(false); }
  };

  const renewAudienceLink = async () => {
    setShareBusy(true);
    setShareError("");
    try { setShareLink(await setLinkExpiry(id, null)); }
    catch (error) { setShareError(error instanceof Error ? error.message : "Could not renew the public link."); }
    finally { setShareBusy(false); }
  };

  const copyAudienceLink = async () => {
    if (!audienceUrl) return;
    try {
      await navigator.clipboard.writeText(audienceUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch { setShareError("Could not copy the link. Select the URL and copy it by hand."); }
  };

  useEffect(() => {
    if (status !== "ready") return;
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const result = await fetchDeckAudiencePolls(id);
        if (alive) { setPolls(result); setPollsError(""); }
      } catch (error) {
        if (alive) setPollsError(error instanceof Error ? error.message : "Could not load poll results.");
      } finally { loading = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, status]);

  // The words for this slide, and the browser voice that reads them while narration is on.
  const narration = useMemo(() => narrationText(deck?.slides[index]), [deck, index]);
  const voice = useNarration(narration, narrateOn);
  const { supported: voiceSupported, stop: stopNarration, paused: narrationPaused, pause: pauseNarration, resume: resumeNarration, replay: replayNarration } = voice;

  const toggleNarration = useCallback(() => {
    if (!voiceSupported) return;
    // Stopping from the click (not the effect) clears the indicator at once; the effect cancels the audio too.
    if (narrateOn) stopNarration();
    setNarrateOn((on) => !on);
  }, [voiceSupported, narrateOn, stopNarration]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setRecordingMessage("Screen recording is not supported in this browser.");
      return;
    }
    setRecordingMessage("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      const mimeType = recordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const actualMimeType = recorder.mimeType || mimeType || "video/webm";
        const extension = actualMimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recordingChunksRef.current, { type: actualMimeType });
        if (blob.size) {
          const base = (deck?.title || "presentation").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70) || "presentation";
          downloadBlob(blob, `${base}.${extension}`);
          setRecordingMessage(`Recording downloaded as ${extension.toUpperCase()}.`);
        }
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorderRef.current = recorder;
      stream.getVideoTracks()[0]?.addEventListener("ended", stopRecording, { once: true });
      recorder.start(1000);
      setRecording(true);
    } catch (error) {
      setRecordingMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "Recording permission was not granted." : "Could not start screen recording.");
    }
  }, [deck?.title, stopRecording]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const goTo = useCallback((target: number) => setIndex((current) => {
    const bounded = Math.max(0, Math.min(count - 1, target));
    if (bounded !== current) setSlideDirection(bounded > current ? "forward" : "backward");
    return bounded;
  }), [count]);
  const next = useCallback(() => setIndex((i) => {
    if (i < count - 1) setSlideDirection("forward");
    return Math.min(count - 1, i + 1);
  }), [count]);
  const prev = useCallback(() => setIndex((i) => {
    if (i > 0) setSlideDirection("backward");
    return Math.max(0, i - 1);
  }), []);

  const exitPresentation = useCallback(() => {
    if (remoteToken) void stopRemoteControl(id).catch(() => undefined);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    router.replace(`/edit/${encodeURIComponent(id)}`);
  }, [id, remoteToken, router]);

  const createRemote = async () => {
    setRemoteBusy(true);
    setRemoteMessage("");
    try {
      const session = await startRemoteControl(id, index);
      remoteRevision.current = session.state.revision;
      setRemoteToken(session.token);
      setRemoteUrl(new URL(`/remote/${session.token}`, window.location.origin).toString());
      setRemoteMessage("Anyone with this link can control the presentation for one hour.");
    } catch (error) {
      setRemoteMessage(error instanceof Error ? error.message : "Could not create a remote-control link.");
    } finally { setRemoteBusy(false); }
  };

  const closeRemote = async () => {
    setRemoteBusy(true);
    try {
      await stopRemoteControl(id);
      setRemoteToken(null);
      setRemoteUrl("");
      remoteRevision.current = 0;
      setRemoteMessage("The remote link has been stopped.");
    } catch (error) {
      setRemoteMessage(error instanceof Error ? error.message : "Could not stop the remote link.");
    } finally { setRemoteBusy(false); }
  };

  const shareRemote = async () => {
    if (!remoteToken || !remoteUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: "Presentation remote", text: "Control this Presenta presentation from your phone.", url: remoteUrl });
      else {
        await navigator.clipboard.writeText(remoteUrl);
        setRemoteCopied(true);
        window.setTimeout(() => setRemoteCopied(false), 1800);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(remoteUrl);
        setRemoteCopied(true);
        window.setTimeout(() => setRemoteCopied(false), 1800);
      } catch {
        setRemoteMessage("Could not share or copy the link. Use the address shown below.");
      }
    }
  };

  const copyRemote = async () => {
    if (!remoteUrl) return;
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setRemoteCopied(true);
      setRemoteMessage("Remote link copied to clipboard.");
      window.setTimeout(() => setRemoteCopied(false), 1800);
    } catch {
      setRemoteMessage("Could not copy the link. Scan the QR code or select the URL.");
    }
  };

  // The presenter tab applies remote commands; local slide changes are sent back so the phone stays in sync.
  useEffect(() => {
    if (!remoteToken) return;
    let alive = true;
    let loading = false;
    const poll = async () => {
      if (loading) return;
      loading = true;
      try {
        const state = await getRemoteControlState(remoteToken);
        if (!alive) return;
        if (!state) {
          setRemoteToken(null);
          setRemoteUrl("");
          setRemoteMessage("The remote link expired or was stopped.");
          return;
        }
        setRemoteMessage("");
        if (state.revision > remoteRevision.current) {
          remoteRevision.current = state.revision;
          goTo(state.slideIndex);
        }
      } catch (error) {
        if (alive) setRemoteMessage(error instanceof Error ? error.message : "Connection interrupted; retrying…");
      } finally { loading = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 800);
    return () => { alive = false; window.clearInterval(timer); };
  }, [remoteToken, goTo]);

  useEffect(() => {
    if (!remoteToken) return;
    void controlRemoteSlide(remoteToken, index).catch(() => setRemoteMessage("Connection interrupted; retrying…"));
  }, [remoteToken, index]);

  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // The voice panel's select and sliders own their keys; only Escape leaves them.
      if (e.key !== "Escape" && (e.target as HTMLElement | null)?.closest(".ps-present-voice, .ps-present-remote, .ps-present-polls, .ps-present-share")) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(count - 1);
          break;
        case "Escape":
          e.preventDefault();
          if (voicePanel) setVoicePanel(false);
          else if (remotePanel) setRemotePanel(false);
          else if (pollsPanel) setPollsPanel(false);
          else if (sharePanel) setSharePanel(false);
          else exitPresentation();
          break;
        case "n":
        case "N":
          e.preventDefault();
          setNotesOpen((v) => !v);
          break;
        case "b":
        case "B":
          e.preventDefault();
          setPollsPanel((open) => !open);
          setVoicePanel(false);
          setRemotePanel(false);
          setSharePanel(false);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "v":
        case "V":
          e.preventDefault();
          toggleNarration();
          break;
        case "p":
        case "P":
          if (!narrateOn) break;
          e.preventDefault();
          if (narrationPaused) resumeNarration();
          else pauseNarration();
          break;
        case "r":
        case "R":
          if (!narrateOn) break;
          e.preventDefault();
          replayNarration();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, count, toggleNarration, narrateOn, voicePanel, remotePanel, pollsPanel, sharePanel, exitPresentation, narrationPaused, pauseNarration, resumeNarration, replayNarration]);

  useEffect(() => {
    const arm = () => {
      setIdle(false);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    arm();
    window.addEventListener("mousemove", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("mousemove", arm);
      window.removeEventListener("keydown", arm);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, []);

  /** Control clicks must not fall through to the stage click that advances. */
  const control = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fn();
  };

  /** Clicking the room advances, except while the voice panel is open: then it closes the panel first. */
  const stageClick = () => {
    if (voicePanel) {
      setVoicePanel(false);
      return;
    }
    if (remotePanel) {
      setRemotePanel(false);
      return;
    }
    if (pollsPanel) {
      setPollsPanel(false);
      return;
    }
    if (sharePanel) {
      setSharePanel(false);
      return;
    }
    next();
  };

  // Preload the next slide's images so the transition is instant.
  useEffect(() => {
    const upcoming = deck?.slides[index + 1];
    if (!upcoming) return;
    for (const src of slideImageSources(upcoming)) {
      const img = new Image();
      img.src = src;
    }
  }, [deck, index]);

  if (status === "loading" || !viewport) {
    return <div className="ps-present" aria-busy="true" />;
  }
  if (status === "missing" || !deck || !theme) {
    return (
      <div className="ps-present ps-present-missing">
        <div>
          <p className="ps-present-missing-title">Deck not found.</p>
          <button type="button" className="ps-present-btn" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  const slide = deck.slides[index];
  const availableH = viewport.h - (notesOpen ? NOTES_HEIGHT : 0);
  const scale = Math.max(0.01, Math.min(viewport.w / STAGE_W, availableH / STAGE_H));
  const boxW = Math.round(STAGE_W * scale);
  const boxH = Math.round(STAGE_H * scale);

  return (
    <div className="ps-present" data-idle={(idle && !voicePanel && !remotePanel && !pollsPanel && !sharePanel) || undefined} onClick={stageClick} data-present-root>
      <div className="ps-present-stage" style={{ height: availableH }}>
        <div style={{ width: boxW, height: boxH, overflow: "hidden", position: "relative" }}>{slide ? <div key={slide.id} className="ps-slide-enter" data-transition={slide.transition ?? "none"} data-direction={slideDirection}><SlideRenderer slide={slide} theme={theme} scale={scale} /></div> : null}</div>
      </div>

      <div className="ps-present-hud" style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 16 }}>
        <span className="ps-present-hud-keys">Esc exit · N notes · B poll results · F fullscreen{voiceSupported ? " · V narrate" : ""}</span>
        <button type="button" className="ps-present-ctl" onClick={control(prev)} disabled={index === 0} aria-label="Previous slide" title="Previous slide (←)">
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="ps-present-hud-count" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button type="button" className="ps-present-ctl" onClick={control(next)} disabled={index >= count - 1} aria-label="Next slide" title="Next slide (→)">
          <CaretRight size={14} weight="bold" />
        </button>
        {voiceSupported ? (
          <>
            <span className="ps-present-hud-sep" aria-hidden />
            <button
              type="button"
              className="ps-present-ctl ps-present-voice-btn"
              data-on={narrateOn || undefined}
              data-speaking={(narrateOn && voice.speaking && !voice.paused) || undefined}
              onClick={control(toggleNarration)}
              aria-pressed={narrateOn}
              aria-label={narrateOn ? "Turn narration off" : "Narrate this slide"}
              title={narrateOn ? "Narration on (V)" : "Narrate this slide (V)"}
            >
              {narrateOn ? <SpeakerHigh size={14} weight="bold" /> : <SpeakerSlash size={14} weight="bold" />}
            </button>
            {narrateOn ? (
              <>
                <button
                  type="button"
                  className="ps-present-ctl"
                  onClick={control(() => (voice.paused ? voice.resume() : voice.pause()))}
                  aria-label={voice.paused ? "Resume narration" : "Pause narration"}
                  title={voice.paused ? "Resume (P)" : "Pause (P)"}
                >
                  {voice.paused ? <Play size={14} weight="fill" /> : <Pause size={14} weight="fill" />}
                </button>
                <button type="button" className="ps-present-ctl" onClick={control(voice.replay)} aria-label="Read this slide again" title="Read again (R)">
                  <ArrowClockwise size={14} weight="bold" />
                </button>
                <button
                  type="button"
                  className="ps-present-ctl"
                  onClick={control(() => { setVoicePanel((open) => !open); setPollsPanel(false); setRemotePanel(false); setSharePanel(false); })}
                  aria-pressed={voicePanel}
                  aria-label="Narration voice and speed"
                  title="Voice and speed"
                >
                  <GearSix size={14} weight="bold" />
                </button>
              </>
            ) : null}
          </>
        ) : null}
        <span className="ps-present-hud-sep" aria-hidden />
        <button type="button" className="ps-present-ctl" data-on={recording || undefined} onClick={control(() => recording ? stopRecording() : void startRecording())} aria-label={recording ? "Stop screen recording" : "Record this presentation"} title={recording ? "Stop recording and download video" : "Record this presentation (screen capture)"}>
          {recording ? <Stop size={13} weight="fill" /> : <VideoCamera size={14} weight="bold" />}
        </button>
        <span className="ps-present-hud-sep" aria-hidden />
        <button type="button" className="ps-present-ctl" onClick={control(() => { setSharePanel((open) => !open); setRemotePanel(false); setPollsPanel(false); setVoicePanel(false); })} aria-label="Share deck with viewers" aria-pressed={sharePanel} title="Share this deck with viewers">
          <ShareNetwork size={14} weight="bold" />
        </button>
        <button type="button" className="ps-present-ctl" data-on={Boolean(remoteToken) || undefined} onClick={control(() => { setRemotePanel((open) => !open); setPollsPanel(false); setVoicePanel(false); setSharePanel(false); })} aria-label="Remote control settings" aria-pressed={remotePanel} title="Control from another device">
          <DeviceMobile size={14} weight="bold" />
        </button>
        <span className="ps-present-hud-sep" aria-hidden />
        <button type="button" className="ps-present-ctl" onClick={control(exitPresentation)} aria-label="Exit presentation" title="Exit (Esc)">
          <X size={14} weight="bold" />
        </button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {recordingMessage || (recording ? "Screen recording in progress" : narrateOn ? (voice.paused ? "Narration paused" : voice.speaking ? "Narrating this slide" : "Narration ready") : "")}
      </span>

      {voiceSupported && narrateOn && voicePanel ? (
        <div
          className="ps-present-voice"
          style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 64 }}
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Narration settings"
        >
          <div className="ps-present-voice-head">
            <span className="ps-present-voice-title">Narration</span>
            <button
              type="button"
              className="ps-present-voice-close"
              onClick={(e) => {
                e.stopPropagation();
                setVoicePanel(false);
              }}
              aria-label="Close narration settings"
              title="Close (Esc)"
            >
              <X size={13} weight="bold" />
            </button>
          </div>
          <label className="ps-present-voice-row">
            <span>Voice</span>
            <select className="ps-present-voice-select" value={voice.prefs.voiceURI} onChange={(e) => voice.setPrefs({ voiceURI: e.target.value })}>
              <option value="">Browser default</option>
              {voice.voices.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="ps-present-voice-row">
            <span>Speed</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={voice.prefs.rate}
              onChange={(e) => voice.setPrefs({ rate: Number(e.target.value) })}
              aria-label="Narration speed"
            />
            <span className="ps-present-voice-value">{voice.prefs.rate.toFixed(2)}×</span>
          </label>
          <label className="ps-present-voice-row">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voice.prefs.volume}
              onChange={(e) => voice.setPrefs({ volume: Number(e.target.value) })}
              aria-label="Narration volume"
            />
            <span className="ps-present-voice-value">{Math.round(voice.prefs.volume * 100)}%</span>
          </label>
          {voice.hasText ? null : <p className="ps-present-voice-note">This slide has no speaker notes or text to read.</p>}
        </div>
      ) : null}

      {sharePanel ? (
        <div className="ps-present-remote ps-present-share" style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 64 }} onClick={(event) => event.stopPropagation()} role="group" aria-label="Share deck with viewers">
          <div className="ps-present-voice-head">
            <span className="ps-present-voice-title">Share this presentation</span>
            <button type="button" className="ps-present-voice-close" onClick={() => setSharePanel(false)} aria-label="Close sharing panel" title="Close (Esc)"><X size={13} weight="bold" /></button>
          </div>
          {shareLoading ? <p className="ps-present-remote-copy">Loading share settings…</p> : null}
          {!shareLoading && audienceUrl ? <>
            <p className="ps-present-remote-copy">Viewers can scan this code or open the link to follow along.</p>
            <div className="ps-present-share-link-row">
              <code className="ps-present-remote-link">{audienceUrl}</code>
              <button type="button" className="ps-present-remote-copy-btn" onClick={() => void copyAudienceLink()} aria-label="Copy public deck link" title="Copy public deck link">
                {shareCopied ? <Check size={15} weight="bold" /> : <CopySimple size={15} weight="bold" />}
              </button>
            </div>
            <div className="ps-present-share-qr">
              <QRCodeSVG value={audienceUrl} size={128} level="M" marginSize={4} title="Scan to open the shared presentation" />
              <span><strong>Scan to view</strong><small>{shareLink?.passwordEnabled ? "Viewers will also need the share password." : "Anyone with this link can view."}</small></span>
            </div>
            {audienceLinkExpired ? <>
              <p className="ps-present-remote-message">This public link has expired.</p>
              <button type="button" className="ps-present-remote-btn ps-present-remote-btn-primary mt-2" onClick={() => void renewAudienceLink()} disabled={shareBusy}>{shareBusy ? "Renewing…" : "Renew public link"}</button>
            </> : null}
          </> : !shareLoading ? <>
            <p className="ps-present-remote-copy">Turn on public viewing to create a link and QR code viewers can use without signing in.</p>
            <button type="button" className="ps-present-remote-btn ps-present-remote-btn-primary" onClick={() => void enableAudienceLink()} disabled={shareBusy}>
              <ShareNetwork size={14} weight="bold" /> {shareBusy ? "Creating link…" : "Enable public view link"}
            </button>
          </> : null}
          {shareError ? <p className="ps-present-remote-message" role="alert">{shareError}</p> : null}
        </div>
      ) : null}

      {remotePanel ? (
        <div className="ps-present-remote" style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 64 }} onClick={(event) => event.stopPropagation()} role="group" aria-label="Phone remote control">
          <div className="ps-present-voice-head">
            <span className="ps-present-voice-title">Phone remote</span>
            <button type="button" className="ps-present-voice-close" onClick={() => setRemotePanel(false)} aria-label="Close remote control panel" title="Close (Esc)"><X size={13} weight="bold" /></button>
          </div>
          {remoteToken ? (
            <>
              <p className="ps-present-remote-copy">Anyone with this link can control the current presentation without signing in. It expires in one hour; creating a new link replaces this one.</p>
              <div className="ps-present-remote-link-row">
                <code className="ps-present-remote-link">{remoteUrl}</code>
                <button type="button" className="ps-present-remote-copy-btn" onClick={() => void copyRemote()} aria-label="Copy remote link" title="Copy remote link">
                  {remoteCopied ? <Check size={15} weight="bold" /> : <CopySimple size={15} weight="bold" />}
                </button>
              </div>
              {remoteUrl ? <div className="ps-present-remote-qr">
                <QRCodeSVG value={remoteUrl} size={144} level="M" marginSize={4} title="Scan to open the presentation remote" />
                <span><strong>Scan with your phone</strong><small>Keep this presentation open while controlling it.</small></span>
              </div> : null}
              <div className="ps-present-remote-actions">
                <button type="button" className="ps-present-remote-btn ps-present-remote-btn-primary" onClick={() => void shareRemote()} disabled={remoteBusy}>
                  {remoteCopied ? <Check size={14} weight="bold" /> : <ShareNetwork size={14} weight="bold" />}
                  {remoteCopied ? "Link copied" : "Share remote link"}
                </button>
                <button type="button" className="ps-present-remote-btn" onClick={() => void closeRemote()} disabled={remoteBusy}>Stop link</button>
              </div>
            </>
          ) : (
            <>
              <p className="ps-present-remote-copy">Create an expiring link for phone controls. Anyone who receives it can move slides until you stop the link.</p>
              <button type="button" className="ps-present-remote-btn ps-present-remote-btn-primary" onClick={() => void createRemote()} disabled={remoteBusy}>
                <DeviceMobile size={14} weight="bold" /> {remoteBusy ? "Creating link…" : "Create remote link"}
              </button>
            </>
          )}
          {remoteMessage ? <p className="ps-present-remote-message" role="status">{remoteMessage}</p> : null}
        </div>
      ) : null}

      {pollsPanel ? (
        <div className="ps-present-remote ps-present-polls" style={{ bottom: (notesOpen ? NOTES_HEIGHT : 0) + 64 }} onClick={(event) => event.stopPropagation()} role="region" aria-label="Live poll results" aria-live="polite">
          <div className="ps-present-voice-head">
            <span className="ps-present-voice-title">{activePoll ? "Live poll results" : latestPoll ? "Last poll results" : "Live poll results"}</span>
            <button type="button" className="ps-present-voice-close" onClick={() => setPollsPanel(false)} aria-label="Close poll results" title="Close (Esc)"><X size={13} weight="bold" /></button>
          </div>
          {pollsError ? <p className="ps-present-remote-message" role="alert">{pollsError}</p> : activePoll || latestPoll ? (() => {
            const poll = activePoll ?? latestPoll!;
            return <>
              <span className="ps-pill" data-tone={activePoll ? "ok" : undefined}>{activePoll ? "Live" : "Ended"}</span>
              <p className="ps-present-poll-question">{poll.prompt}</p>
              <ul className="ps-present-poll-options">
                {poll.options.map((option, i) => {
                  const votes = poll.voteCounts[i] ?? 0;
                  const percent = poll.totalVotes ? Math.round(votes / poll.totalVotes * 100) : 0;
                  return <li key={`${poll.id}-${i}`}>
                    <div className="ps-present-poll-option"><span>{option}</span><strong>{percent}% <small>{votes}</small></strong></div>
                    <div className="ps-present-poll-track"><span style={{ width: `${percent}%` }} /></div>
                  </li>;
                })}
              </ul>
              <p className="ps-present-remote-message">{poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} · refreshes automatically</p>
            </>;
          })() : <p className="ps-present-remote-copy">No poll is active. Start one from More → Live polls in the editor.</p>}
        </div>
      ) : null}

      {notesOpen ? <PresentNotes index={index} notes={slide?.notes} /> : null}
    </div>
  );
}
