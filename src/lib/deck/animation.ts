import type { AnimationEffect, Element, Slide } from "./schema";

export type AnimationPlanEntry = { effect: AnimationEffect; duration: number; delay: number; groupIndex: number };

export type AnimationPlan = {
  /** Animated elements keyed by id, in slide (z) order. Elements without a real animation are absent. */
  byElement: Map<string, AnimationPlanEntry>;
  /** Number of clicks needed to reveal the whole slide, beyond the group that plays on entry. */
  extraSteps: number;
};

const NONE_PLAN: AnimationPlan = { byElement: new Map(), extraSteps: 0 };

/**
 * Groups a slide's animated elements into build steps: `onClick` (or the first animated element)
 * starts a new step; `withPrevious` and `afterPrevious` join the step in progress. The first step
 * always plays on slide entry, with no click required; `extraSteps` counts the rest.
 */
export function computeAnimationPlan(slide: Slide): AnimationPlan {
  const elements = [...slide.elements].sort((a, b) => a.z - b.z).filter(hasAnimation);
  if (elements.length === 0) return NONE_PLAN;

  const byElement = new Map<string, AnimationPlanEntry>();
  let groupIndex = -1;
  let withinGroup = 0;
  for (const el of elements) {
    const anim = el.animation!;
    if (groupIndex === -1 || anim.trigger === "onClick") {
      groupIndex += 1;
      withinGroup = 0;
    } else {
      withinGroup += 1;
    }
    // "afterPrevious" plays automatically once its slot in the step is reached; approximated here as a
    // staggered delay within the same (already-revealed) build step rather than a separate click.
    const stagger = anim.trigger === "afterPrevious" ? withinGroup * anim.duration : 0;
    byElement.set(el.id, { effect: anim.effect, duration: anim.duration, delay: anim.delay + stagger, groupIndex });
  }
  return { byElement, extraSteps: Math.max(groupIndex, 0) };
}

function hasAnimation(el: Element): boolean {
  return Boolean(el.animation && el.animation.effect !== "none");
}
