import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cockpit Telemetry',
  description: 'Personal quota and wake-up monitor for Antigravity, Codex and Claude accounts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans bg-[#0f1012] text-[#f3f4f6] min-h-screen selection:bg-[#38bdf8]/20 selection:text-[#f3f4f6]">
        {children}
      </body>
    </html>
  );
}
