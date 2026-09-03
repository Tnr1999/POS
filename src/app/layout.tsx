import type { Metadata, Viewport } from "next";
import { Anuphan, Geist_Mono, Kanit } from "next/font/google";
import { Toaster } from "@/components/Toast";
import "./globals.css";

// Body font, Thai-first — see DESIGN.md. Geist Sans (the previous body
// font) ships no Thai subset at all, so every Thai string on staff screens
// was silently falling back through the browser's default sans-serif this
// whole time; Anuphan actually covers Thai + Latin.
const anuphan = Anuphan({
  variable: "--font-anuphan",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "thai"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the customer-facing order page only (shop name, menu
// section headers) — see DESIGN.md "The Two-Places Rule". Thai + Latin.
// Kanit — clean geometric sans, simple/modern rather than a decorative
// display face (swapped from Chonburi per feedback: "เรียบง่าย").
const kanit = Kanit({
  variable: "--font-kanit",
  weight: ["500", "600"],
  subsets: ["latin", "thai"],
});

export const metadata: Metadata = {
  title: "บ้านอร่อย POS",
  description: "ระบบขายหน้าร้าน + สั่งอาหารผ่าน QR code",
};

export const viewport: Viewport = {
  // no dark mode — always light/cream regardless of the OS/browser theme
  // setting (per feedback: "don't like the black background at all")
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${anuphan.variable} ${geistMono.variable} ${kanit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
