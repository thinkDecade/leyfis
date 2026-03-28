import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "Leyfis - Institutional Compliance on Solana",
  description: "On-chain KYC/AML access control for institutional DeFi vaults. Cryptographic attestations. Protocol-level enforcement. Immutable audit trail.",
  keywords: ["DeFi compliance", "KYC", "AML", "Solana", "institutional"],
  authors: [{ name: "Leyfis" }],
  metadataBase: new URL("https://leyfis-app.netlify.app"),
  openGraph: {
    title: "Leyfis - Institutional Compliance on Solana",
    description: "On-chain compliance middleware for institutional DeFi vaults. Verifies KYC/AML attestations before execution.",
    type: "website",
    url: "https://leyfis-app.netlify.app",
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
