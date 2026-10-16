import type { Slide, Theme } from "@/lib/deck/schema";
import { FitSlide } from "@/components/canvas/FitSlide";
import { Dots } from "@/components/ui-kit/Dots";
import { NavButton } from "./NavButton";

type Props = {
  slide: Slide | undefined;
  theme: Theme;
  index: number;
  count: number;
  onIndexChange: (i: number) => void;
};

/** Selected slide in a card with previous/next buttons (dots under 900 px); `.ps-review-hero-slide` caps the width by viewport height. */
export function ReviewHero({ slide, theme, index, count, onIndexChange }: Props) {
  return (
    <section aria-label="Selected slide" className="ps-review-hero">
      <NavButton direction="prev" onClick={() => onIndexChange(Math.max(0, index - 1))} disabled={index === 0} />
      <div className="ps-review-hero-card">
        {slide ? <FitSlide key={slide.id} slide={slide} theme={theme} className="ps-review-hero-slide mx-auto" /> : null}
        <div className="ps-review-hero-foot" aria-live="polite">
          <span>
            Slide {index + 1} of {count}
            <span className="hidden sm:inline"> · use ← → to move</span>
          </span>
        </div>
        <div className="ps-review-dots">
          <Dots count={count} active={index} onSelect={onIndexChange} />
        </div>
      </div>
      <NavButton direction="next" onClick={() => onIndexChange(Math.min(count - 1, index + 1))} disabled={index >= count - 1} />
    </section>
  );
}
