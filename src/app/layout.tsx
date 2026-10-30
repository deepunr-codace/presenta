import type { Metadata } from "next";
import { DM_Sans, Inter, Inter_Tight, Outfit, Oswald, Roboto } from "next/font/google";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AccountSync } from "@/components/shell/AccountSync";
import { MiniDeck } from "@/components/shell/MiniDeck";
import { TeamMessengerProvider } from "@/components/teams/TeamMessengerProvider";
import { NavProgress } from "@/components/shell/NavProgress";
import { ThemeModeProvider } from "@/components/shell/ThemeMode";
import { ToastProvider } from "@/components/shell/Toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["300", "500", "600", "700"] });
const dmSans = DM_Sans({ variable: "--font-dm", subsets: ["latin"], weight: ["400", "500", "700"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["300", "500", "600"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500"] });

const DESCRIPTION = "AI presentation builder: describe a deck in plain language, get a designed deck, edit anything.";

export const metadata: Metadata = {
  title: { default: "Presenta Studio — AI presentation builder", template: "%s · Presenta" },
  description: DESCRIPTION,
  applicationName: "Presenta Studio",
  // icon.svg, apple-icon.png, favicon.ico and manifest.webmanifest are picked up automatically by filename convention.
  openGraph: {
    title: "Presenta Studio",
    description: DESCRIPTION,
    siteName: "Presenta Studio",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Presenta Studio",
    description: DESCRIPTION,
  },
};

/** App chrome fonts: Inter for everything (DESIGN.md §3). Inter Tight, DM Sans, Oswald and Roboto are loaded for slide themes. */
const chromeFonts = {
  "--font-sans": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  "--font-heading": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
} as CSSProperties;

/**
 * Runs before hydration: sets `data-theme` on <html> from localStorage
 * ("presenta:theme") or the OS preference so the first paint is already in
 * the right mode. Keep in sync with ThemeMode.tsx.
 */
const themeInitScript =
  '(function(){try{var s=localStorage.getItem("presenta:theme");var m=s==="light"||s==="dark"?s:null;' +
  'if(!m){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}' +
  'document.documentElement.setAttribute("data-theme",m);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      style={chromeFonts}
      className={`${inter.variable} ${interTight.variable} ${dmSans.variable} ${outfit.variable} ${oswald.variable} ${roboto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-[var(--ps-canvas)] text-foreground">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <SessionProvider>
          <AccountSync />
          <ThemeModeProvider>
            <TooltipProvider delay={200}>
              <ToastProvider>
                <TeamMessengerProvider>
                  {children}
                </TeamMessengerProvider>
                <MiniDeck />
              </ToastProvider>
            </TooltipProvider>
          </ThemeModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
