import { CaretLeft, CaretRight } from "@phosphor-icons/react";

type Props = {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
};

/** 28 px secondary icon button beside the hero slide. */
export function NavButton({ direction, onClick, disabled }: Props) {
  const label = direction === "prev" ? "Previous slide" : "Next slide";
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="ps-nav">
      {direction === "prev" ? <CaretLeft size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
    </button>
  );
}
