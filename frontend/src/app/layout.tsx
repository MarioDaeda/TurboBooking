import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TurboBooking — Gestionale Salone',
  description: 'Gestionale per saloni di bellezza e barbieri, replica pixel-accurate di Treatwell Pro',
  other: {
    'darkreader-lock': '',
  },
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
