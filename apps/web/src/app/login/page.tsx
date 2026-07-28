'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useLogin } from '@/hooks/use-login';
import { loginSchema, type LoginValues } from '@/schemas/login.schema';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false); const router = useRouter(); const login = useLogin();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const submit = form.handleSubmit(async (values) => { try { await login.mutateAsync(values); router.replace('/'); } catch { /* rendered below */ } });
  const apiMessage = axios.isAxiosError(login.error) ? (login.error.response?.data as { message?: string } | undefined)?.message : undefined;
  return <main className="grid min-h-screen bg-[#f3f6f2] lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden flex-col justify-between bg-[#24463a] p-14 text-white lg:flex"><div className="flex items-center gap-3 text-xl font-bold"><span className="grid size-10 place-items-center rounded-xl bg-white/15"><Leaf size={22} /></span>JivaTax</div><div className="max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[.22em] text-emerald-200">Gestión tributaria clara</p><h1 className="text-5xl font-semibold leading-tight tracking-tight">Tu información contable, segura y siempre bajo control.</h1><p className="mt-6 text-lg leading-8 text-emerald-50/80">Accede a un espacio profesional para preparar y administrar el Balance Tributario.</p></div><p className="text-sm text-emerald-50/60">JivaTax · Seguridad y confianza para tu organización</p></section>
    <section className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-10"><div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-[#315b4c] text-white"><Leaf size={21} /></span><span className="text-xl font-bold">JivaTax</span></div><h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bienvenido</h1><p className="mt-2 text-sm leading-6 text-slate-500">Ingresa con tu correo y contraseña para continuar.</p>
      <form className="mt-8 space-y-5" onSubmit={submit} noValidate><div><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">Correo electrónico</label><div className="relative"><Mail className="absolute left-3 top-3 text-slate-400" size={18}/><input id="email" type="email" autoComplete="email" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" aria-invalid={!!form.formState.errors.email} {...form.register('email')} /></div>{form.formState.errors.email && <p role="alert" className="mt-1.5 text-sm text-red-700">{form.formState.errors.email.message}</p>}</div>
      <div><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">Contraseña</label><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-slate-400" size={18}/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-11 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" aria-invalid={!!form.formState.errors.password} {...form.register('password')} /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-2 top-1.5 grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{form.formState.errors.password && <p role="alert" className="mt-1.5 text-sm text-red-700">{form.formState.errors.password.message}</p>}</div>
      {login.isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{apiMessage ?? 'No pudimos iniciar sesión. Intenta nuevamente.'}</div>}<Button className="h-11 w-full" disabled={login.isPending} type="submit">{login.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}</Button></form></div></section>
  </main>;
}
