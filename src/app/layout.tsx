import type { Metadata } from "next";
import {
  Archivo,
  Bricolage_Grotesque,
  Cormorant,
  DM_Sans,
  Fraunces,
  Instrument_Sans,
  Inter,
  Inter_Tight,
  JetBrains_Mono,
  Manrope,
  Montserrat,
  Outfit,
  Oswald,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Roboto,
  Space_Grotesk,
  Syne,
  Unbounded,
} from "next/font/google";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AccountSync } from "@/components/shell/AccountSync";
import { SessionWatch } from "@/components/shell/SessionWatch";
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

/** Loaded for the 10 downloaded "studio pack" deck themes, each pairing one of these with DM Sans or Inter. */
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500", "700"] });
const playfairDisplay = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plusJakartaSans = Plus_Jakarta_Sans({ variable: "--font-plus-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const cormorant = Cormorant({ variable: "--font-cormorant", subsets: ["latin"], weight: ["400", "500", "600"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const bricolageGrotesque = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const studioFonts = [spaceGrotesk, jetbrainsMono, playfairDisplay, fraunces, manrope, plusJakartaSans, cormorant, montserrat, unbounded, instrumentSans, syne, bricolageGrotesque, archivo];

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
      className={`${inter.variable} ${interTight.variable} ${dmSans.variable} ${outfit.variable} ${oswald.variable} ${roboto.variable} ${studioFonts.map((f) => f.variable).join(" ")} h-full antialiased`}
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
          <SessionWatch />
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
