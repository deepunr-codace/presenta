"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell as BellIcon } from "lucide-react";
import { Check, ChatCircleDots, EnvelopeSimple, Info, X } from "@phosphor-icons/react";
import { fetchTeamMessages, fetchTeams } from "@/lib/collab";
import { clearAppNotifications, getAppNotifications, getNotificationChatCursors, getSeenInviteTokens, markAppNotificationRead, recordAppNotification, rememberInviteTokens, saveNotificationChatCursors, subscribeAppNotifications, type AppNotification } from "@/lib/notifications";

const POLL_MS = 10000;

export function NotificationsCenter() {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.reduce((total, item) => total + Number(!item.read), 0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sync = useCallback(() => {
    if (userId) setItems(getAppNotifications(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    sync();
    return subscribeAppNotifications(userId, sync);
  }, [userId, sync]);

  // Poll team activity in the background so chat messages and invitations reach the inbox on every app page.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let polling = false;
    const cursors = new Map(Object.entries(getNotificationChatCursors(userId)));
    const knownInvites = new Set(getSeenInviteTokens(userId));

    const poll = async () => {
      if (document.hidden || polling) return;
      polling = true;
      try {
        const { teams, invites } = await fetchTeams();
        if (!alive) return;
        for (const invite of invites) {
          if (knownInvites.has(invite.token)) continue;
          knownInvites.add(invite.token);
          recordAppNotification(userId, {
            id: `invite:${invite.token}`,
            kind: "invite",
            title: "Team invitation",
            body: `${invite.invitedBy} invited you to ${invite.teamName}.`,
            createdAt: new Date().toISOString(),
            href: `/invite/${encodeURIComponent(invite.token)}`,
          });
        }
        rememberInviteTokens(userId, Array.from(knownInvites));
        await Promise.all(teams.map(async (team) => {
          const cursor = cursors.get(team.id);
          const messages = await fetchTeamMessages(team.id, cursor);
          if (!alive) return;
          if (cursors.has(team.id)) {
            for (const message of messages) {
              if (message.userId === userId) continue;
              recordAppNotification(userId, {
                id: `message:${team.id}:${message.id}`,
                kind: "message",
                title: `New message · ${team.name}`,
                body: `${message.name}: ${message.body.slice(0, 180)}`,
                createdAt: message.createdAt,
                href: `/teams?team=${encodeURIComponent(team.id)}&chat=1`,
              });
            }
          }
          const last = messages[messages.length - 1]?.id;
          if (last) cursors.set(team.id, last);
          else if (!cursors.has(team.id)) cursors.set(team.id, "");
        }));
        if (alive) saveNotificationChatCursors(userId, Object.fromEntries(cursors));
      } catch {
        // A background poll should never interrupt the current page; retry on the next interval.
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisibility = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  const visit = (item: AppNotification) => {
    if (!userId) return;
    markAppNotificationRead(userId, item.id);
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  };

  if (!userId) return null;

  return (
    <div className="ps-notifications" ref={rootRef}>
      <button type="button" className="ps-iconbtn ps-notifications-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls="ps-notification-panel" onClick={() => setOpen((value) => !value)}>
        <BellIcon size={18} strokeWidth={1.8} aria-hidden />
        {unread ? <span className="ps-notifications-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <section id="ps-notification-panel" className="ps-notification-panel" role="dialog" aria-label="Notifications">
          <header className="ps-notification-head">
            <div><h2>Notifications</h2><p>{unread ? `${unread} unread` : "You’re all caught up"}</p></div>
            <div className="ps-notification-head-actions">
              {unread ? <button type="button" className="ps-notification-text-btn" onClick={() => userId && markAppNotificationRead(userId)}>Mark all read</button> : null}
              <button type="button" className="ps-iconbtn ps-iconbtn-sm" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={14} /></button>
            </div>
          </header>
          {items.length ? <>
            <div className="ps-notification-list">
              {items.map((item) => {
                const Icon = item.kind === "message" ? ChatCircleDots : item.kind === "invite" ? EnvelopeSimple : Info;
                return <button type="button" key={item.id} className="ps-notification-item" data-unread={!item.read ? "true" : undefined} onClick={() => visit(item)}>
                  <span className="ps-notification-icon"><Icon size={16} /></span>
                  <span className="ps-notification-copy"><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</time></span>
                  {!item.read ? <span className="ps-notification-unread-dot" aria-label="Unread" /> : null}
                </button>;
              })}
            </div>
            <footer className="ps-notification-foot"><button type="button" className="ps-notification-text-btn" onClick={() => userId && clearAppNotifications(userId)}><Check size={13} /> Clear all</button></footer>
          </> : <div className="ps-notification-empty"><span><BellIcon size={18} strokeWidth={1.8} aria-hidden /></span><strong>No notifications yet</strong><p>Messages, invitations, and app updates will appear here.</p></div>}
        </section>
      ) : null}
    </div>
  );
}
