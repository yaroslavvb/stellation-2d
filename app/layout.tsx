import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yaroslavvb.github.io/stellation-2d/"),
  title: "Stellation & Facetting 2D — Dual polygon explorer",
  description:
    "Explore dual polygon constructions: extend sides and select stellation cells, or keep the original vertices and reconnect them into facetted circuits.",
  applicationName: "Stellation & Facetting 2D",
  authors: [{ name: "Yaroslav Bulatov" }],
  icons: {
    icon: "./favicon.svg",
    shortcut: "./favicon.svg",
  },
  openGraph: {
    title: "Stellation & Facetting 2D",
    description: "Extend sides for stellation, or reconnect fixed vertices for facetting.",
    type: "website",
    url: "https://yaroslavvb.github.io/stellation-2d/",
    images: [
      {
        url: "https://yaroslavvb.github.io/stellation-2d/og.png",
        width: 1536,
        height: 1024,
        alt: "Stellation and Facetting 2D dual polygon constructions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stellation & Facetting 2D",
    description: "Explore polygon stellations and facettings through linked 2D and 1D views.",
    images: ["https://yaroslavvb.github.io/stellation-2d/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
