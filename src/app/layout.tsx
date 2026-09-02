import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Chonburi } from "next/font/google";
import { Toaster } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the customer-facing order page only (shop name, menu
// section headers) — see DESIGN.md "The Two-Places Rule". Thai + Latin.
const chonburi = Chonburi({
  variable: "--font-chonburi",
  weight: "400",
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  title: "ร้านค้า POS",
  description: "ระบบขายหน้าร้าน + สั่งอาหารผ่าน QR code",
};

export const viewport: Viewport = {
  // lets the browser theme its own chrome (scrollbar, form controls) to
  // match — the page itself follows prefers-color-scheme via globals.css
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} ${chonburi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
