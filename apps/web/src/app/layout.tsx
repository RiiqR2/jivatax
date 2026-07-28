import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthenticatedShell } from '@/components/auth/authenticated-shell';
import { AppProviders } from '@/providers/app-providers';
import './globals.css';

export const metadata: Metadata = { title: 'JivaTax', description: 'Plataforma para la preparación del Balance Tributario' };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="es"><body><AppProviders><AuthenticatedShell>{children}</AuthenticatedShell></AppProviders></body></html>; }
