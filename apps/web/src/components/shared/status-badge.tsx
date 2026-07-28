import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type Variant = 'success' | 'warning' | 'error' | 'neutral' | 'info';
const styles: Record<Variant, string> = { success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', warning: 'bg-amber-50 text-amber-700 ring-amber-600/20', error: 'bg-red-50 text-red-700 ring-red-600/20', neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20', info: 'bg-blue-50 text-blue-700 ring-blue-600/20' };
export function StatusBadge({ children, variant = 'neutral' }: { children: ReactNode; variant?: Variant }) { return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', styles[variant])}>{children}</span>; }
