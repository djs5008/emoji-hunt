/**
 * Root Layout Component
 * 
 * @description The root layout for the Next.js app router. Provides:
 * - Global font configuration (Inter)
 * - Full-height layout structure
 * - SEO metadata
 * - Global CSS imports
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Load Inter font with Latin subset for optimal performance
const inter = Inter({ subsets: ['latin'] });

/**
 * Global metadata for SEO and browser display
 */
export const metadata: Metadata = {
  title: 'Emoji Hunt',
  description: 'A collaborative emoji finding game',
  icons: {
    icon: '/favicon.svg',
  },
};

/**
 * Root layout wrapper for all pages
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content to render
 * 
 * Layout features:
 * - Full height container (h-full)
 * - Overflow handling for scrollable content
 * - suppressHydrationWarning to prevent Next.js hydration mismatch warnings
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`} suppressHydrationWarning>
        <div className="h-full overflow-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
