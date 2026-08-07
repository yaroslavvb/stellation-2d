import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yaroslavvb.github.io/stellation-2d/"),
  title: "Stellation 2D — Interactive polygon stellation explorer",
  description:
    "Extend a regular polygon's sides, assemble stellations from the bounded cells they form, and explore the exact one-dimensional diagram beneath the construction.",
  applicationName: "Stellation 2D",
  authors: [{ name: "Yaroslav Bulatov" }],
  icons: {
    icon: "./favicon.svg",
    shortcut: "./favicon.svg",
  },
  openGraph: {
    title: "Stellation 2D",
    description: "The stellation app reduced by one dimension: 2D cells with a linked 1D diagram.",
    type: "website",
    url: "https://yaroslavvb.github.io/stellation-2d/",
    images: [
      {
        url: "https://yaroslavvb.github.io/stellation-2d/og.png",
        width: 1536,
        height: 1024,
        alt: "Stellation 2D pentagon line arrangement and one-dimensional diagram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stellation 2D",
    description: "Explore polygon stellations through linked 2D and 1D views.",
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
