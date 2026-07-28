'use client';
import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LoadingState } from '@/components/shared/loading-state';
import { useSession } from '@/hooks/use-session';
export function AuthenticatedShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname(); const router = useRouter(); const isLogin = pathname === '/login'; const session = useSession(!isLogin);
  useEffect(() => { if (!isLogin && session.isError && axios.isAxiosError(session.error) && session.error.response?.status === 401) router.replace('/login'); }, [isLogin, router, session.error, session.isError]);
  if (isLogin) return children;
  if (session.isPending) return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando sesión…" /></main>;
  if (session.isError) return null;
  return <DashboardShell>{children}</DashboardShell>;
}
