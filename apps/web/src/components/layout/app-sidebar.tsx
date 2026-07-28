import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { mainNavigation, secondaryNavigation } from '@/config/navigation';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  return <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex lg:flex-col"><div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white"><Leaf className="size-5" /></span><div><p className="font-semibold tracking-tight text-white">JivaTax</p><p className="text-[11px] text-slate-400">Gestión tributaria</p></div></div><nav className="flex flex-1 flex-col justify-between p-3" aria-label="Navegación principal"><div className="space-y-1">{mainNavigation.map((item, index) => <Link key={item.label} href={item.href} aria-disabled={item.disabled} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition', index === 0 ? 'bg-slate-800 font-medium text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white', item.disabled && 'pointer-events-none opacity-50')}><item.icon className="size-4" />{item.label}</Link>)}</div><div className="space-y-1 border-t border-slate-800 pt-3">{secondaryNavigation.map((item) => <Link key={item.label} href={item.href} aria-disabled={item.disabled} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 opacity-50"><item.icon className="size-4" />{item.label}</Link>)}</div></nav></aside>;
}
