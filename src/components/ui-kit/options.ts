export type Option<T extends string> = { value: T; label: string };

/** Turn a list of string values into select options, capitalising unless a label is given. */
export function opts<T extends string>(values: readonly T[], labels?: Partial<Record<T, string>>): Option<T>[] {
  return values.map((v) => ({ value: v, label: labels?.[v] ?? v.charAt(0).toUpperCase() + v.slice(1) }));
}
