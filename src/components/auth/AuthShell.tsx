import type { ReactNode } from "react";
import { Lightning, Shapes, Sparkle } from "@phosphor-icons/react";
import { Mark } from "@/components/shell/Mark";

const VALUE_PROPS = [
  { icon: <Sparkle size={16} />, text: "Describe a deck in plain language and watch it build itself." },
  { icon: <Shapes size={16} />, text: "Every slide stays fully editable — text, layout, theme, brand." },
  { icon: <Lightning size={16} />, text: "Export to PDF or PowerPoint the moment it's ready." },
];

type Props = {
  children: ReactNode;
};

/** Shared full-screen frame for /login and /signup: a branding panel on wide screens, the form centred on narrow ones. */
export function AuthShell({ children }: Props) {
  return (
    <div className="ps-auth-shell">
      <aside className="ps-auth-panel">
        <div className="ps-wordmark">
          <Mark size={28} />
          Presenta
        </div>
        <div className="ps-auth-panel-body">
          <p className="ps-display ps-auth-headline">
            Your next deck, <span className="ps-accent">already designed</span>.
          </p>
          <ul className="ps-auth-props">
            {VALUE_PROPS.map((p, i) => (
              <li key={i}>
                <span className="ps-iconchip">{p.icon}</span>
                <span className="ps-body-lg">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="ps-caption">Presenta Studio — AI presentation builder</p>
      </aside>
      <main className="ps-auth-main">{children}</main>
    </div>
  );
}
