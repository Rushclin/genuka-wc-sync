import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Head from "next/head";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Genuka Woo Commerce Sync",
  description: "Application de synchronisation des commandes, produits et clients de Genuka vers Woo Commerce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" />
      </Head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-tr from-[#E65C2E] via-[#F3A055]
       to-[#7FBEB3]`}
      >
        <Toaster />

        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
          <div className="flex items-center justify-between">
            <Image
              src="https://genuka.com/favicon.ico"
              alt="Genuka logo"
              width={50}
              height={38}
              priority
            />
            <Button variant="outline" size="icon" className="mx-10 rounded-full">
              <ChevronRight />
            </Button>
            <Image
              src="https://woocommerce.com/wp-content/themes/woo/images/woo-logo.svg"
              alt="Woo Commerce logo"
              width={80}
              height={38}
              priority
            />
          </div>

          {children}

          <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
            <a
              className="flex items-center gap-2 hover:underline hover:underline-offset-4"
              href="https://genuka.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                aria-hidden
                src="/globe.svg"
                alt="Globe icon"
                width={16}
                height={16}
              />
              Copyrigth 2025 &copy; Genuka →
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
