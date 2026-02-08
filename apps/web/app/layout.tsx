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
  title: 'NextGen Marketplace',
  description: 'Modern marketplace for vendors and customers',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} ${fraunces.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
