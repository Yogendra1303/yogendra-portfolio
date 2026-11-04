import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono, Syncopate } from "next/font/google";
import "./globals.css";

const display = Syncopate({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-display" });
const text = Inter({ subsets: ["latin"], variable: "--font-text" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500"], style: ["italic", "normal"], variable: "--font-serif-face" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: "Yogendra Singh Kapkoti · Worldlines",
  description: "Nine years, no straight lines: a career in operations, strategy and go-to-market, told as a film.",
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
