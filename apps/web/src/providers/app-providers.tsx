'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from '@/providers/query-provider';

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
