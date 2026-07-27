import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'JivaTax',
  description: 'Plataforma para la preparación del Balance Tributario',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <div className="shell">
          <header className="topbar"><div className="brand"><span className="brand-mark">J</span> JivaTax</div></header>
          {children}
        </div>
      </body>
    </html>
  );
}
