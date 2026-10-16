type Props = {
  index: number;
  notes: string | undefined;
};

/** Speaker-notes band under the slide (toggle with N). */
export function PresentNotes({ index, notes }: Props) {
  return (
    <div className="ps-present-notes" onClick={(e) => e.stopPropagation()}>
      <div className="ps-present-notes-eyebrow">Speaker notes · slide {index + 1}</div>
      {notes ? <p className="ps-present-notes-text">{notes}</p> : <p className="ps-present-notes-empty">No notes for this slide.</p>}
    </div>
  );
}
