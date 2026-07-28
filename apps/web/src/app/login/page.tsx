"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/hooks/use-login";
import { loginSchema, type LoginFormValues } from "@/schemas/login.schema";
export default function LoginPage() {
  const [visible, setVisible] = useState(false);
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-20 size-96 rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-600">
            <Leaf className="size-6" />
          </span>
          <div>
            <p className="text-xl font-semibold">JivaTax</p>
            <p className="text-xs text-slate-400">Gestión tributaria</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[.18em] text-emerald-400">
            Administración segura
          </p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">
            Tu operación tributaria, organizada en un solo lugar.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Accede a la información de tu organización con una sesión protegida
            y controles de seguridad modernos.
          </p>
        </div>
        <p className="relative text-sm text-slate-500">© JivaTax</p>
      </section>
      <section className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-white">
              <Leaf className="size-5" />
            </span>
            <span className="text-xl font-semibold text-slate-950">
              JivaTax
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Iniciar sesión
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Ingresa tus datos para acceder al panel administrativo.
              </p>
            </div>
            <form
              noValidate
              onSubmit={handleSubmit((values) =>
                login.mutate(loginSchema.parse(values)),
              )}
              className="space-y-5"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    placeholder="tu@empresa.cl"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p
                    id="email-error"
                    role="alert"
                    className="mt-1.5 text-sm text-red-700"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
                  <input
                    id="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((value) => !value)}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                    aria-label={
                      visible ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {visible ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="mt-1.5 text-sm text-red-700"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>
              {login.isError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                >
                  Correo o contraseña incorrectos.
                </div>
              )}
              <Button
                type="submit"
                disabled={login.isPending}
                className="h-11 w-full"
              >
                {login.isPending ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Ingresando…
                  </>
                ) : (
                  "Iniciar sesión"
                )}
              </Button>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Tus credenciales se transmiten mediante una conexión segura.
          </p>
        </div>
      </section>
    </main>
  );
}
