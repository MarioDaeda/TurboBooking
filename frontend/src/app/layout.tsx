import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TurboBooking — Gestionale Salone',
  description: 'Gestionale per saloni di bellezza e barbieri, replica pixel-accurate di Treatwell Pro',
  appleWebApp: {
    capable: true,
    title: 'TurboBooking',
    statusBarStyle: 'default',
  },
  other: {
    'darkreader-lock': '',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
