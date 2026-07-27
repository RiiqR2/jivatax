import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) { return <div className="flex min-h-screen bg-slate-50"><AppSidebar /><div className="min-w-0 flex-1"><AppHeader /><div>{children}</div></div></div>; }
