type Props = {
  size?: number;
  className?: string;
};

/** Product mark: a 24 px ink rounded square with a two-tone spark (violet and orange) cut-out, the one place the sparks appear in chrome. */
export function Mark({ size = 24, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <rect width="24" height="24" rx="6" fill="var(--ps-ink)" />
      <path d="M12 4.5c.6 4.4 3.1 6.9 7.5 7.5-4.4.6-6.9 3.1-7.5 7.5V4.5Z" fill="var(--ps-spark-orange)" />
      <path d="M12 4.5c-.6 4.4-3.1 6.9-7.5 7.5 4.4.6 6.9 3.1 7.5 7.5V4.5Z" fill="var(--ps-spark-violet)" />
    </svg>
  );
}
