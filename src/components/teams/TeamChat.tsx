"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { fetchTeamMessages, sendTeamMessage, type TeamMessage } from "@/lib/collab";
import { timeAgo } from "@/lib/time";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

/** How often the chat asks for new messages. Nothing is fetched while the tab is hidden. */
const POLL_MS = 5000;

/** New messages only, in the order the server sent them, never duplicating one that is already on screen. */
function merge(current: TeamMessage[], incoming: TeamMessage[]): TeamMessage[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  return fresh.length ? [...current, ...fresh] : current;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

/** A team's channel: the newest messages, a composer, and a quiet poll for what others post. */
export function TeamChat({ teamId }: { teamId: string }) {
  const { data: session } = useSession();
  const myId = session?.user?.id ?? null;

  const [messages, setMessages] = useState<TeamMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const logRef = useRef<HTMLDivElement | null>(null);
  /** True while the reader is at the bottom, so new messages follow; scrolling up to read stops the jump. */
  const stick = useRef(true);

  const fail = useCallback((err: unknown) => setError(err instanceof Error ? err.message : "Could not reach the team chat."), []);

  // First load. The screen mounts this component per team, so there is no stale list to clear here.
  useEffect(() => {
    let alive = true;
    fetchTeamMessages(teamId)
      .then((list) => {
        if (!alive) return;
        stick.current = true;
        setMessages(list);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        fail(err);
        setMessages([]);
      });
    return () => {
      alive = false;
    };
  }, [teamId, fail]);

  // Poll for new messages. Re-armed with the newest id so a poll only fetches what is new.
  useEffect(() => {
    if (!messages) return;
    const last = messages[messages.length - 1]?.id ?? null;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      fetchTeamMessages(teamId, last)
        .then((next) => {
          if (next.length) setMessages((prev) => merge(prev ?? [], next));
        })
        .catch(() => {
          /* a missed poll is not worth an error banner; the next one catches up */
        });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [teamId, messages]);

  // Follow the conversation when the reader is already at the bottom.
  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const post = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const message = await sendTeamMessage(teamId, body);
      setText("");
      stick.current = true;
      setMessages((prev) => merge(prev ?? [], [message]));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  return (
    <div className="ps-chat">
      <div ref={logRef} className="ps-chat-log" role="log" aria-live="polite" aria-label="Team messages" onScroll={onScroll}>
        {messages === null ? <p className="ps-caption">Loading messages…</p> : null}
        {messages && messages.length === 0 ? <p className="ps-body">No messages yet. Say hello to your team.</p> : null}
        {messages?.map((m) => {
          const mine = m.userId === myId;
          return (
            <div key={m.id} className="ps-chat-msg" data-mine={mine ? "true" : undefined}>
              {mine ? null : <span className="ps-chat-name">{m.name}</span>}
              <span className="ps-chat-text">{m.body}</span>
              <time className="ps-chat-time" dateTime={m.createdAt} title={timeAgo(m.createdAt)}>
                {clock(m.createdAt)}
              </time>
            </div>
          );
        })}
      </div>

      {error ? <ErrorNotice compact message={error} /> : null}

      <form
        className="ps-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void post();
        }}
      >
        <textarea
          className="ps-input ps-chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void post();
            }
          }}
          placeholder="Message your team"
          aria-label="Message your team"
          rows={1}
          maxLength={2000}
        />
        <button type="submit" className="ps-btn ps-btn-primary ps-btn-xs" disabled={busy || !text.trim()}>
          <PaperPlaneRight size={14} /> Send
        </button>
      </form>
      <p className="ps-caption">Enter sends, Shift + Enter breaks the line. New messages arrive on their own every few seconds.</p>
    </div>
  );
}
