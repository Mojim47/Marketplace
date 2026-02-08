import './globals.css';
import { Vazirmatn, Fraunces } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: 'NextGen Admin',
  description: 'Admin Panel',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} ${fraunces.variable} antialiased`}>{children}</body>
    </html>
  );
}
