import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import type { Slide, Theme } from "@/lib/deck/schema";
import { FitSlide } from "@/components/canvas/FitSlide";
import { slideTitle } from "./deck-stats";

type Props = {
  slide: Slide;
  theme: Theme;
  index: number;
  active: boolean;
  onSelect: () => void;
  editHref: string;
};

/** Thumbnail in the "All slides" grid: primary ring when active, then a caption row with the number, title and an Edit link on hover. */
export function SlideThumb({ slide, theme, index, active, onSelect, editHref }: Props) {
  const title = slideTitle(slide);
  return (
    <div className="ps-review-thumb-wrap">
      <button type="button" onClick={onSelect} aria-pressed={active} aria-label={`Select slide ${index + 1}: ${title}`} className="ps-review-thumb">
        <div className="ps-thumb" data-active={active}>
          <FitSlide slide={slide} theme={theme} />
        </div>
      </button>
      <div className="ps-review-thumb-foot" data-active={active}>
        <span className="ps-review-thumb-num" aria-hidden>
          {index + 1}
        </span>
        <span className="ps-review-thumb-title" title={title}>
          {title}
        </span>
        <Link href={editHref} className="ps-link" aria-label={`Edit slide ${index + 1}`}>
          <PencilSimple size={12} weight="bold" /> Edit
        </Link>
      </div>
    </div>
  );
}
