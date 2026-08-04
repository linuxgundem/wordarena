import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WordArena - Akıllı Online İsim-Şehir Oyunu",
  description: "Gerçek zamanlı, yapay zekâ destekli, tamamen tarayıcı üzerinden çalışan modern İsim-Şehir deneyimi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-50 flex flex-col antialiased overflow-x-hidden`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
