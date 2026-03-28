import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "Leyfis Admin - Institutional Operations Console",
  description: "Role-gated operations console for vault operators, KYC issuers, and compliance auditors. On-chain role detection. FATF R.16 compliant.",
  authors: [{ name: "Leyfis" }],
  metadataBase: new URL("https://leyfis-admin.netlify.app"),
  openGraph: {
    title: "Leyfis Admin - Institutional Operations Console",
    description: "Role-gated operations console for vault operators, KYC issuers, and compliance auditors.",
    type: "website",
    url: "https://leyfis-admin.netlify.app",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
