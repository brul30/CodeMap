import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
// Design system shipped by the designer (componentsUI/assets/styles.css), verbatim.
import "@/styles/codemap.css";
// Onboarding screens (landing / picker / loading) ported from Get Started.html.
import "@/styles/onboarding.css";
// Font-variable bridge + tiny overrides — loaded last so it wins the cascade.
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeMap — See your codebase before you read it",
  description:
    "CodeMap reverse-engineers a live architecture map of any repository, then walks you through it with an AI voice tour.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
