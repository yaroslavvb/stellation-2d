import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yaroslavvb.github.io/stellation-2d/"),
  title: "Facetting 2D — Interactive polygon cell explorer",
  description:
    "Extend a regular polygon's sides, explore the bounded cells they form, and see the exact one-dimensional diagram beneath the construction.",
  applicationName: "Facetting 2D",
  authors: [{ name: "Yaroslav Bulatov" }],
  icons: {
    icon: "./favicon.svg",
    shortcut: "./favicon.svg",
  },
  openGraph: {
    title: "Facetting 2D",
    description: "A dimensional analogue of the stellation app: 2D cells with a 1D diagram.",
    type: "website",
    url: "https://yaroslavvb.github.io/stellation-2d/",
    images: [
      {
        url: "https://yaroslavvb.github.io/stellation-2d/og.png",
        width: 1536,
        height: 1024,
        alt: "Facetting 2D pentagon line arrangement and one-dimensional diagram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Facetting 2D",
    description: "Explore planar facetting through linked 2D and 1D views.",
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
