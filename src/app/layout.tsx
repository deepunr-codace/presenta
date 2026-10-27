import type { Metadata } from "next";
import { DM_Sans, Inter, Inter_Tight, Oswald, Roboto } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeModeProvider } from "@/components/shell/ThemeMode";
import { ToastProvider } from "@/components/shell/Toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["300", "500", "600", "700"] });
const dmSans = DM_Sans({ variable: "--font-dm", subsets: ["latin"], weight: ["400", "500", "700"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["300", "500", "600"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Presenta Studio",
  description: "AI presentation builder: chat or paste, get a designed deck, edit anything.",
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
      className={`${inter.variable} ${interTight.variable} ${dmSans.variable} ${oswald.variable} ${roboto.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-[var(--ps-canvas)] text-foreground">
        <SessionProvider>
          <ThemeModeProvider>
            <TooltipProvider delay={200}>
              <ToastProvider>{children}</ToastProvider>
            </TooltipProvider>
          </ThemeModeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
