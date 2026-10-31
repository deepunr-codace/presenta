"use client";

import { ArrowRight, Check, DotsThree, Globe, Lock, PencilSimple, Trash, UsersThree, BookmarkSimple } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamSummary } from "@/lib/collab";
import type { TemplateEntry } from "@/lib/templates";

type Props = {
  title: string;
  onUse: () => void;
  /** Only for templates of mine in the library. */
  mine?: {
    template: TemplateEntry;
    teams: TeamSummary[];
    onEdit: () => void;
    /** "personal", "global" or "team:<id>". */
    onVisibility: (value: string) => void;
    onDelete: () => void;
  };
  /** Someone else's template: who shared it. */
  sharedBy?: string;
  /** Built-in decks: keep a copy in my library. */
  onSaveCopy?: () => void;
};

const Mark = ({ on }: { on: boolean }) => <Check size={13} weight="bold" className={on ? "ml-auto" : "invisible ml-auto"} aria-hidden />;

/** The three-dot menu on a template card. */
export function TemplateCardMenu({ title, onUse, mine, sharedBy, onSaveCopy }: Props) {
  const t = mine?.template;
  const current = t ? (t.scope === "team" ? `team:${t.teamIds[0] ?? ""}` : t.scope) : "";
  return (
    <div className="ps-tpl-menu" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className="ps-tpl-menu-btn" aria-label={`Actions for ${title}`} />}>
          <DotsThree size={18} weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {sharedBy ? <DropdownMenuLabel className="truncate">Shared by {sharedBy}</DropdownMenuLabel> : null}
          <DropdownMenuItem onClick={onUse}>
            <ArrowRight /> Use template
          </DropdownMenuItem>
          {onSaveCopy ? (
            <DropdownMenuItem onClick={onSaveCopy}>
              <BookmarkSimple /> Save to my templates
            </DropdownMenuItem>
          ) : null}
          {mine ? (
            <>
              <DropdownMenuItem onClick={mine.onEdit}>
                <PencilSimple /> Edit details
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t?.scope === "global" ? <Globe /> : t?.scope === "team" ? <UsersThree /> : <Lock />} Who can use it
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  <DropdownMenuItem onClick={() => mine.onVisibility("personal")}>
                    <Lock /> Only me <Mark on={current === "personal"} />
                  </DropdownMenuItem>
                  {mine.teams.map((team) => (
                    <DropdownMenuItem key={team.id} onClick={() => mine.onVisibility(`team:${team.id}`)}>
                      <UsersThree /> <span className="truncate">{team.name}</span> <Mark on={current === `team:${team.id}`} />
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => mine.onVisibility("global")}>
                    <Globe /> Everyone <Mark on={current === "global"} />
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={mine.onDelete}>
                <Trash /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
