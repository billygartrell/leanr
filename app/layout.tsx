import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://leanr-bg.netlify.app"),
  title: "Setmark — Training Log",
  description: "A fast, focused workout log for every set and every personal best.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Setmark — Every Set. Every Best.",
    description: "A fast, focused workout log for every set and every personal best.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Setmark — Every Set. Every Best." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Setmark — Every Set. Every Best.",
    description: "A fast, focused workout log for every set and every personal best.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
