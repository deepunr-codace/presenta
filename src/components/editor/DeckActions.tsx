"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaretDown, ChatCircleDots, ChartBar, ClockCounterClockwise, DotsThree, FilePdf, FileText, GoogleLogo, Microphone, PencilSimple, Play, Presentation, ShareNetwork, SlackLogo } from "@phosphor-icons/react";
import { postDeckToSlack, saveDeckToGoogleDrive, triggerZapier } from "@/lib/collab";
import { resolveTheme } from "@/lib/deck/themes";
import { flushSave, useDeckStore } from "@/store/deck-store";
import { useToast } from "@/components/shell/Toast";
import { editHref } from "@/components/review/deck-stats";
import { ExportMenu } from "./ExportMenu";
import { ShareDialog } from "./ShareDialog";
import { CommentsDialog } from "./CommentsDialog";
import { VersionHistoryDialog } from "./VersionHistoryDialog";
import { AudienceQuestionsDialog } from "./AudienceQuestionsDialog";
import { AudiencePollsDialog } from "./AudiencePollsDialog";
import { exportDeck } from "./deck-export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = {
  id: string;
  /** Editor: Present opens a new tab. Review: Present navigates in place and an Edit link is added. */
  mode: "edit" | "review";
};

/** Page actions for the shell's top bar: Export (secondary), Edit (review only) and Present (primary). */
export function DeckActions({ id, mode }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [pollsOpen, setPollsOpen] = useState(false);
  const [slackBusy, setSlackBusy] = useState(false);
  const [zapierBusy, setZapierBusy] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const deck = useDeckStore((s) => (s.deck?.id === id ? s.deck : null));
  const theme = deck ? resolveTheme(deck) : null;

  const present = async () => {
    // Present mode loads the deck from the server, so let the pending save land first.
    await flushSave();
    const href = `/present/${encodeURIComponent(id)}`;
    if (mode === "edit") window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  const rehearse = async () => {
    const opened = mode === "edit" ? window.open("about:blank", "_blank") : null;
    if (opened) opened.opener = null;
    try {
      await flushSave();
      const href = `/coach/${encodeURIComponent(id)}`;
      if (mode === "edit" && opened) opened.location.href = href;
      else router.push(href);
    } catch (error) {
      opened?.close();
      toast(error instanceof Error ? error.message : "Could not save the deck before rehearsal.", { tone: "error" });
    }
  };

  const shareToSlack = async () => {
    if (!deck || slackBusy) return;
    setSlackBusy(true);
    try {
      await flushSave();
      await postDeckToSlack(id, deck.title || "Untitled deck");
      toast("Deck posted to Slack.", { tone: "success" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not post this deck to Slack.", { tone: "error" });
    } finally { setSlackBusy(false); }
  };

  const sendToZapier = async () => {
    if (!deck || zapierBusy) return;
    setZapierBusy(true);
    try {
      await flushSave();
      await triggerZapier(id);
      toast("Deck sent to Zapier.", { tone: "success" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send this deck to Zapier.", { tone: "error" });
    } finally { setZapierBusy(false); }
  };

  const saveToDrive = async () => {
    if (!deck || driveBusy) return;
    setDriveBusy(true);
    try {
      await flushSave();
      const file = await saveDeckToGoogleDrive(id);
      toast("Presenta backup saved to Google Drive.", { tone: "success", action: { label: "Open in Drive", onClick: () => window.open(file.url, "_blank", "noopener,noreferrer") } });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save this deck to Google Drive.", { tone: "error" });
    } finally { setDriveBusy(false); }
  };

  const runExport = async (kind: "pdf" | "pptx" | "json") => {
    if (!deck || !theme || exportBusy) return;
    setExportBusy(true);
    try {
      const limitations = await exportDeck(deck, theme, kind);
      if (limitations.length) {
        const summary = limitations.join(" ");
        toast(`PowerPoint exported with simplifications: ${summary}`, { tone: "info", duration: 9000 });
      } else {
        const message = kind === "pptx" ? "PowerPoint downloaded." : kind === "json" ? "Deck JSON downloaded." : "PDF print view opened.";
        toast(message, { tone: "success" });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not export this deck.", { tone: "error" });
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <>
      {/* Group related actions to keep the deck header focused. */}
      <button type="button" className="ps-btn ps-btn-ghost px-2 sm:px-3" onClick={() => setShareOpen(true)} disabled={!deck} aria-label="Share this deck" title="Share this deck">
        <ShareNetwork size={12} weight="bold" /><span className="hidden sm:inline">Share</span>
      </button>
      {mode === "review" ? <Link href={editHref(id)} className="ps-btn ps-btn-ghost px-2 sm:px-3" aria-label="Open in the editor" title="Open in the editor">
        <PencilSimple size={12} weight="bold" /><span className="hidden sm:inline">Edit</span>
      </Link> : null}
      <span className="hidden sm:contents">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ps-btn ps-btn-ghost" disabled={!deck} />}>
            <DotsThree size={16} weight="bold" /> More <CaretDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => setCommentsOpen(true)}><ChatCircleDots /> Comments</DropdownMenuItem>
            {mode === "edit" ? <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setQuestionsOpen(true)}><ChatCircleDots /> Audience Q&amp;A</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPollsOpen(true)}><ChartBar /> Live polls</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}><ClockCounterClockwise /> Version history</DropdownMenuItem>
            </> : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ps-btn ps-btn-ghost" disabled={!deck} />}>
            <GoogleLogo size={12} weight="bold" /> Integrations <CaretDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem disabled={slackBusy} onClick={() => void shareToSlack()}><SlackLogo /> {slackBusy ? "Posting to Slack…" : "Send to Slack"}</DropdownMenuItem>
            <DropdownMenuItem disabled={zapierBusy} onClick={() => void sendToZapier()}><ChatCircleDots /> {zapierBusy ? "Sending to Zapier…" : "Send to Zapier"}</DropdownMenuItem>
            <DropdownMenuItem disabled={driveBusy} onClick={() => void saveToDrive()}><GoogleLogo /> {driveBusy ? "Saving to Drive…" : "Back up to Drive"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ExportMenu disabled={!deck} busy={exportBusy} onExport={(kind) => void runExport(kind)} />
      </span>
      <span className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" className="ps-btn ps-btn-ghost px-2" aria-label="More deck actions" disabled={!deck} />}>
            <DotsThree size={18} weight="bold" /><span>More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="ps-mobile-action-menu min-w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><ChatCircleDots /> Feedback</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="ps-mobile-action-submenu">
                <DropdownMenuItem onClick={() => setCommentsOpen(true)}><ChatCircleDots /> Comments</DropdownMenuItem>
                {mode === "edit" ? <>
                  <DropdownMenuItem onClick={() => setQuestionsOpen(true)}><ChatCircleDots /> Audience Q&amp;A</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPollsOpen(true)}><ChartBar /> Live polls</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setHistoryOpen(true)}><ClockCounterClockwise /> Version history</DropdownMenuItem>
                </> : null}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><GoogleLogo /> Integrations</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="ps-mobile-action-submenu">
                <DropdownMenuItem disabled={slackBusy} onClick={() => void shareToSlack()}><SlackLogo /> {slackBusy ? "Posting to Slack…" : "Send to Slack"}</DropdownMenuItem>
                <DropdownMenuItem disabled={zapierBusy} onClick={() => void sendToZapier()}><ChatCircleDots /> {zapierBusy ? "Sending to Zapier…" : "Send to Zapier"}</DropdownMenuItem>
                <DropdownMenuItem disabled={driveBusy} onClick={() => void saveToDrive()}><GoogleLogo /> {driveBusy ? "Saving to Drive…" : "Back up to Drive"}</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><FileText /> Export</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="ps-mobile-action-submenu">
                <DropdownMenuItem disabled={exportBusy} onClick={() => void runExport("pdf")}><FilePdf /> PDF (print)</DropdownMenuItem>
                <DropdownMenuItem disabled={exportBusy} onClick={() => void runExport("pptx")}><Presentation /> PowerPoint (.pptx)</DropdownMenuItem>
                <DropdownMenuItem disabled={exportBusy} onClick={() => void runExport("json")}><FileText /> Deck JSON</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <button type="button" className="ps-btn ps-btn-ghost px-2 sm:px-3" onClick={() => void rehearse()} disabled={!deck} aria-label="Rehearse this deck with Presenter Coach" title="Rehearse this deck with Presenter Coach">
        <Microphone size={13} weight="bold" /><span className="hidden sm:inline">Rehearse</span>
      </button>
      <span className="ps-toolbar-sep" aria-hidden />
      <button type="button" className="ps-btn ps-btn-primary" onClick={() => void present()} disabled={!deck} title={mode === "edit" ? "Open in presentation mode" : "Present from the first slide"}>
        <Play size={12} weight="fill" />
        Present
      </button>
      {shareOpen ? <ShareDialog id={id} open={shareOpen} onOpenChange={setShareOpen} /> : null}
      {commentsOpen ? <CommentsDialog id={id} open={commentsOpen} onOpenChange={setCommentsOpen} /> : null}
      {historyOpen ? <VersionHistoryDialog id={id} open={historyOpen} onOpenChange={setHistoryOpen} /> : null}
      {questionsOpen ? <AudienceQuestionsDialog id={id} open={questionsOpen} onOpenChange={setQuestionsOpen} /> : null}
      {pollsOpen ? <AudiencePollsDialog id={id} open={pollsOpen} onOpenChange={setPollsOpen} /> : null}
    </>
  );
}
