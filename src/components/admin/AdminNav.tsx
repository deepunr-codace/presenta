import Link from "next/link";

const LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ai", label: "Presenta Studio AI" },
] as const;

/** Switches between the admin pages. */
export function AdminNav({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.href === current ? "ps-btn ps-btn-primary ps-btn-xs" : "ps-btn ps-btn-xs"} aria-current={l.href === current ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
