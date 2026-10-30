"use client";

import { FilmStrip, Play } from "@phosphor-icons/react";
import type { VideoElement } from "@/lib/deck/schema";

function videoEmbed(src: string): { kind: "embed" | "file"; src: string } {
  const url = new URL(src);
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}` };
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    const id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.split("/").filter(Boolean).at(-1);
    return id ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : { kind: "file", src };
  }
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    return id ? { kind: "embed", src: `https://player.vimeo.com/video/${encodeURIComponent(id)}` } : { kind: "file", src };
  }
  return { kind: "file", src };
}

export function VideoView({ element, interactive = false }: { element: VideoElement; interactive?: boolean }) {
  const source = videoEmbed(element.src);
  if (interactive) return <div className="grid size-full place-items-center bg-black text-white" aria-label={`Video: ${element.title}`}><div className="flex flex-col items-center gap-2"><span className="grid size-12 place-items-center rounded-full bg-white/15"><Play size={22} weight="fill" /></span><span className="flex items-center gap-1.5 text-sm"><FilmStrip size={15} />{element.title || "Video"}</span><span className="max-w-[90%] truncate text-xs text-white/60">{element.src}</span></div></div>;
  return <div className="size-full" onClick={(event) => event.stopPropagation()}>{source.kind === "embed" ? <iframe className="size-full border-0" src={source.src} title={element.title || "Embedded video"} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" /> : <video className="size-full bg-black object-contain" src={source.src} controls playsInline preload="metadata" aria-label={element.title || "Embedded video"} />}</div>;
}
