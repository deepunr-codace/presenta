"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HardDrives, Images, Presentation } from "@phosphor-icons/react";
import { fetchStorage, type StorageUsage } from "@/lib/drive";
import { formatBytes } from "@/lib/media";
import { StorageMeter } from "@/components/decks/StorageMeter";

/** How much of the account's storage is used, split into decks and media, with where to free space. */
export function StorageCard() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchStorage()
      .then((u) => alive && setUsage(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const free = usage ? Math.max(usage.limit - usage.used, 0) : 0;

  return (
    <section className="ps-glass h-full" data-paper aria-labelledby="storage-title">
      <div className="flex items-center gap-2">
        <HardDrives size={20} weight="light" aria-hidden />
        <h2 id="storage-title" className="ps-cardtitle">
          Storage
        </h2>
      </div>
      {failed ? <p className="ps-body mt-3">Could not load your storage right now.</p> : null}
      {!usage && !failed ? <div className="mt-4 h-16 animate-pulse rounded-[var(--ps-r-md)] bg-[var(--ps-plate)]" aria-hidden /> : null}
      {usage ? (
        <>
          <p className="mt-3 text-[28px] leading-8 font-medium text-[var(--ps-ink)]">
            {formatBytes(usage.used)} <span className="text-[14px] font-normal text-[var(--ps-smoke)]">of {formatBytes(usage.limit)}</span>
          </p>
          <StorageMeter used={usage.used} limit={usage.limit} className="mt-3" />
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-[var(--ps-r-md)] border border-[var(--ps-line)] p-3">
              <Presentation size={22} weight="light" aria-hidden />
              <div>
                <dt className="ps-caption">Decks</dt>
                <dd className="text-[14px] text-[var(--ps-ink)]">
                  {formatBytes(usage.decks.bytes)} · {usage.decks.count} {usage.decks.count === 1 ? "deck" : "decks"}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[var(--ps-r-md)] border border-[var(--ps-line)] p-3">
              <Images size={22} weight="light" aria-hidden />
              <div>
                <dt className="ps-caption">Images and videos</dt>
                <dd className="text-[14px] text-[var(--ps-ink)]">
                  {formatBytes(usage.media.bytes)} · {usage.media.count} {usage.media.count === 1 ? "file" : "files"}
                </dd>
              </div>
            </div>
          </dl>
          <p className="ps-caption mt-4">
            {formatBytes(free)} free. Decks in the trash still count until it is emptied.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/decks" className="ps-btn ps-btn-xs">
              Manage decks
            </Link>
            <Link href="/media" className="ps-btn ps-btn-xs">
              Media library
            </Link>
            <Link href="/trash" className="ps-btn ps-btn-xs">
              Empty trash
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}
