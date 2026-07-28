'use client';
import { LoaderCircle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useSession } from '@/hooks/use-session';
export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) { const pathname = usePathname(); if (pathname === '/login') return children; return <ProtectedDashboard>{children}</ProtectedDashboard>; }
function ProtectedDashboard({ children }: Readonly<{ children: ReactNode }>) { const session = useSession(); const router = useRouter(); useEffect(() => { if (session.status === 'unauthenticated') router.replace('/login'); }, [router, session.status]); if (session.status !== 'authenticated') return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="flex items-center gap-3 text-sm text-slate-600"><LoaderCircle className="size-5 animate-spin text-emerald-700" />Validando sesión…</div></div>; return <div className="flex min-h-screen bg-slate-50"><AppSidebar /><div className="min-w-0 flex-1"><AppHeader /><div>{children}</div></div></div>; }
