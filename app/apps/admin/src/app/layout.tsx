import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";
export const metadata: Metadata = {
  title: "LEYFIS Admin",
  description: "On-chain compliance infrastructure",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><WalletContextProvider>{children}</WalletContextProvider></body></html>);
}
